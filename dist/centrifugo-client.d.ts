import { LoggerInstance } from "winston";
export interface CentrifugoClientOptions {
    path: string;
    secret: string;
    id: string;
    onMessage: Function;
    logger?: LoggerInstance;
}
export default class CentrifugoClient {
    private path;
    private id;
    private logger;
    private onMessage;
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
    private connectIfDisconnected();
    private reconnect();
    private batchSubscribe();
    private heartbeat();
    private processMessage(message);
    private createSubscribeCommand(channel, last?);
    private createCommand(method, params?);
    private sendConnectCommand();
    private send(data);
    private sendCommand(command);
}
