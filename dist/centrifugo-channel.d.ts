export declare class CentrifugoChannel {
    private _name;
    private _lastMessageId;
    constructor(channelNameExtended: string);
    channelToString(): string;
    readonly name: string;
    readonly lastMessageId: string | null;
}
