"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CentrifugoChannel = (function () {
    function CentrifugoChannel(channelNameExtended) {
        var chunks = channelNameExtended.split("***");
        var channelName = chunks[0];
        var lastMessageId = chunks.length === 2 ? chunks[1] : null;
        this._name = channelName;
        this._lastMessageId = lastMessageId;
    }
    CentrifugoChannel.prototype.channelToString = function () {
        var channelString = this._name;
        channelString += this._lastMessageId ? ("***" + this._lastMessageId) : "";
        return channelString;
    };
    Object.defineProperty(CentrifugoChannel.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CentrifugoChannel.prototype, "lastMessageId", {
        get: function () {
            return this._lastMessageId;
        },
        enumerable: true,
        configurable: true
    });
    return CentrifugoChannel;
}());
exports.CentrifugoChannel = CentrifugoChannel;
//# sourceMappingURL=centrifugo-channel.js.map