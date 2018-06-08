import { Token } from "jscent";
import { LoggerInstance } from "winston";
import { v4 } from "uuid";
import * as WebSocket from "ws";
import Timer = NodeJS.Timer;

type CentrifugoCommand = ICentrifugoCommand | ICentrifugoCommand[];

export interface CentrifugoClientOptions {
    path: string,
    secret: string,
    onMessageCallback?: Function,
    logger?: LoggerInstance,
}

interface ICentrifugoCommand {
    method: string;
    params?: Map<any, any>;
    uid: string;
}

export const enum ConnectionStatus {
    DISCONNECTED = "DISCONNECTED",
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
}

class CentrifugoChannel {
    private isNew: boolean = true;
    private lastMessageId: string;
    private name: string;

    constructor(name: string, lastMessageId: string = null) {
        this.name = name;
        this.lastMessageId = lastMessageId;
        this.isNew = true;
    }

    public getParams() {
        let params = {"channel": this.name};

        if (this.isNew && this.lastMessageId) {
            params["last"] = this.lastMessageId;
            params["recover"] = true;
        }

        return params;
    }

    public markAsSubscribed() {
        this.isNew = false;
    }
}

/**
 * Connecting after first listener subscription.
 * After connection error set timer to reconnect.
 *
 * Additionally client sends periodical ping messages to Centrifugo for keeping connection alive.
 * @url https://fzambia.gitbooks.io/centrifugal/content/mixed/ping.html
 */
export class CentrifugoClient {
    private path: string;
    private id: string;
    private logger: LoggerInstance;
    private onMessageCallback: Function;
    private tokenGenerator: Token;
    private ws: WebSocket;
    private isClosed: boolean = false;

    private connectionStatus = ConnectionStatus.DISCONNECTED;
    private isAlive: boolean = false;
    private heartbeatTimer: Timer;
    private messageCounter = 0;
    private subscribedChannels = new Map<string, CentrifugoChannel>();

    private readonly heartbeatInterval = 30000;
    private readonly subscribeChannelsChunkSize = 100;
    private readonly reconnectInterval = 5000;

    constructor(options: CentrifugoClientOptions) {
        this.path = options.path;
        this.tokenGenerator = new Token(options.secret);
        this.logger = options.logger;
        this.id = v4();
        this.onMessageCallback = options.onMessageCallback;
    }

    public connect(): this {
        if (!this.setConnectionStatus(ConnectionStatus.CONNECTING)) {
            return this;
        }

        this.initWebSocket();

        return this;
    }

    public subscribe(channel: string, lastMessageId?: string): this {
        this.isClosed = false;
        this.connect();
        this.unsubscribe(channel);
        const centrifugoChannel = new CentrifugoChannel(channel, lastMessageId);
        this.subscribedChannels.set(channel, centrifugoChannel);

        if (this.connectionStatus == ConnectionStatus.CONNECTED) {
            this.sendCommand(this.createSubscribeCommand(centrifugoChannel));
            centrifugoChannel.markAsSubscribed();
        }

        return this;
    }

    public unsubscribe(channel: string): this {
        if (this.subscribedChannels.has(channel)) {
            this.connect();
            this.subscribedChannels.delete(channel);

            if (this.connectionStatus == ConnectionStatus.CONNECTED) {
                this.sendCommand(this.createCommand("unsubscribe", {channel}));
            }
        }

        return this;
    }

    public setOnMessageCallback(onMessage: Function): this {
        this.onMessageCallback = onMessage;

        return this;
    }

    public getOnMessageCallback(): Function {
        return this.onMessageCallback;
    }

    public close(): void {
        this.isClosed = true;
        this.onMessageCallback = null;

        if (this.ws) {
            this.ws.close();
        }
    }

    private initWebSocket(): void {
        this.ws = new WebSocket(this.path, {
            perMessageDeflate: false,
            handshakeTimeout: 1000,
        } as any);

        this.ws.on("open", () => {
            this.sendConnectCommand();
        });

        this.ws.on("close", () => {
            if (!this.setConnectionStatus(ConnectionStatus.DISCONNECTED)) {
                return this;
            }

            clearInterval(this.heartbeatTimer);

            if (!this.isClosed) {
                this.logError("Centrifugo connection closed");
                this.reconnect();
            }
        });

        this.ws.on("error", (error) => {
            this.logError("Centrifugo websocket error", error);
        });

        this.ws.on("message", (data: string) => {
            this.logMessage("<- " + data);

            const decodedData = JSON.parse(data);

            if (Array.isArray(decodedData)) {
                decodedData.forEach((message) => this.processMessage(message));
            } else {
                this.processMessage(decodedData);
            }
        });
    }
    
    private logMessage(message: string, data = {}): void {
        this.logger.debug("centrifugo client " + message, data);
    }
    
    private logError(message: string, data = {}): void {
        this.logger.error("centrifugo client ERROR " + message, data);
    }

    private logCantChangeStatusTo(to: ConnectionStatus, reason: string = "") {
        this.logMessage("!! Cant change status from '" + this.connectionStatus + "' to '" + to + "'. " + reason);
    }
    
    private setConnectionStatus(status: ConnectionStatus): boolean {
        if (this.isClosed && status !== ConnectionStatus.DISCONNECTED) {
            this.logCantChangeStatusTo(status,"Client is closed.");
            return false;
        }

        if (status === ConnectionStatus.CONNECTING && this.connectionStatus !== ConnectionStatus.DISCONNECTED) {
            this.logCantChangeStatusTo(status);
            return false;
        }

        this.logMessage("!! Change status from '" + this.connectionStatus + "' to '" + status + "'");

        this.connectionStatus = status;

        return true;
    }

    private reconnect(): this {
        setTimeout(() => {
            this.logMessage("!! reconnect");

            this.connect();
        }, this.reconnectInterval);

        return this;
    }

    private batchSubscribe(): void {
        const subscribedChannels = this.subscribedChannels.values();

        let commands: ICentrifugoCommand[] = [];

        // Split to chunks to prevent centrifugo `overflow max_client_queue_size` limit overflow.
        for (const subscribedChannel of subscribedChannels) {
            const command = this.createSubscribeCommand(subscribedChannel);

            commands.push(command);
            subscribedChannel.markAsSubscribed();

            if (commands.length === this.subscribeChannelsChunkSize) {
                this.sendCommand(commands);

                commands = [];
            }
        }

        if (commands.length > 0) {
            this.sendCommand(commands);
        }
    }

    private heartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.isAlive === false) {
                return this.ws.terminate();
            }

            this.isAlive = false;

            this.sendPingCommand();
        }, this.heartbeatInterval);
    }

    private sendPingCommand(): void {
        const command = this.createCommand("ping");

        this.sendCommand(command);
    }

    private processMessage(message: any): void {
        if (message.error) {
            this.logError("error", {
                error: message.error,
                channel: message.body.channel,
            });

            return;
        }

        switch (message.method) {
            case "connect":
                if (!this.setConnectionStatus(ConnectionStatus.CONNECTED)) {
                    break;
                }

                this.isAlive = true;

                this.heartbeat();
                this.batchSubscribe();
                break;
            case "ping":
                this.isAlive = true;
                break;
            case "disconnect":
                this.logError("Received disconnect. Reason: " + message.body.reason);
                break;
            case "message":
                this.onMessage(message.body.channel, message.body.data);
                break;
            case "subscribe":
                if ("body" in message && message.body.messages instanceof Array) {
                    for (const singleMessage of message.body.messages) {
                        this.onMessage(message.body.channel, singleMessage.data);
                    }
                }
        }
    }

    private onMessage (channel: string, message: object): void {
        if (this.onMessageCallback) {
            this.onMessageCallback(channel, message);
        }
    }

    private createSubscribeCommand(centrifugoChannel: CentrifugoChannel) {
        let params = centrifugoChannel.getParams();

        return this.createCommand("subscribe", params);
    }

    private createCommand(method: string, params: any = null): ICentrifugoCommand {
        this.messageCounter++;

        let command = {
            uid: this.messageCounter.toString(),
            method,
        };

        if (params) {
            command['params'] = params;
        }

        return command;
    }

    private sendConnectCommand(): void {
        const user = this.id;
        const timestamp = Date.now().toString();
        const info = "";

        this.sendCommand(this.createCommand("connect", {
            user,
            info,
            timestamp,
            token: this.tokenGenerator.clientToken(user, timestamp, info),
        }));
    }

    private send(data: CentrifugoCommand): Promise<void> {
        return new Promise((resolve, reject) => {
            const encodedData = JSON.stringify(data);
            this.logMessage("-> " + encodedData);

            this.ws.send(encodedData, (error) => {
                if (this.isClosed) {
                    return resolve();
                } else if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private async sendCommand(command: CentrifugoCommand): Promise<void> {
        try {
            await this.send(command);
        } catch (error) {
            this.logError("WebSocket send error", error);
        }
    }
}
