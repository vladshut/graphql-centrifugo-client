import { LoggerInstance } from "winston";
export interface CentrifugoClientOptions {
    path: string;
    secret: string;
    onMessageCallback?: Function;
    logger?: LoggerInstance;
}
export declare const enum ConnectionStatus {
    DISCONNECTED = "DISCONNECTED",
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
}
export declare class CentrifugoClient {
    private path;
    private id;
    private logger;
    private onMessageCallback;
    private tokenGenerator;
    private ws;
    private isClosed;
    private connectionStatus;
    private isAlive;
    private heartbeatTimer;
    private messageCounter;
    private subscribedChannels;
    private readonly heartbeatInterval;
    private readonly subscribeChannelsChunkSize;
    private readonly reconnectInterval;
    constructor(options: CentrifugoClientOptions);
    connect(): this;
    private initWebSocket();
    subscribe(channel: string, lastMessageId?: string): this;
    unsubscribe(channel: string): this;
    setOnMessageCallback(onMessage: Function): this;
    getOnMessageCallback(): Function;
    close(): void;
    private logMessage(message, data?);
    private logError(message, data?);
    private logCantChangeStatusTo(to, reason?);
    private setConnectionStatus(status);
    private reconnect();
    private batchSubscribe();
    private heartbeat();
    private sendPingCommand();
    private processMessage(message);
    private onMessage(channel, message);
    private createSubscribeCommand(centrifugoChannel);
    private createCommand(method, params?);
    private sendConnectCommand();
    private send(data);
    private sendCommand(command);
}
