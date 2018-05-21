import { LoggerInstance } from "winston";
export interface CentrifugoClientOptions {
    path: string;
    secret: string;
    id: string;
    onMessageCallback?: Function;
    logger?: LoggerInstance;
}
export declare class CentrifugoClient {
    private path;
    private id;
    private logger;
    private onMessageCallback;
    private tokenGenerator;
    private ws;
    private log;
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
    subscribe(channel: string, lastMessageId?: string): this;
    unsubscribe(channel: string): this;
    getId(): string;
    setOnMessageCallback(onMessage: Function): this;
    getOnMessageCallback(): Function;
    private connectIfDisconnected();
    private reconnect();
    private batchSubscribe();
    private heartbeat();
    private processMessage(message);
    private onMessage(channel, message);
    private createSubscribeCommand(centrifugoChannel);
    private createCommand(method, params?);
    private sendConnectCommand();
    private send(data);
    private sendCommand(command);
}
