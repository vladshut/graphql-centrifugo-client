"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
const jscent_1 = require("jscent");
const WebSocket = require("ws");
class CentrifugoChannel {
    constructor(name, lastMessageId = null) {
        this.isNew = true;
        this.name = name;
        this.lastMessageId = lastMessageId;
        this.isNew = true;
    }
    getParams() {
        let params = { "channel": this.name };
        if (this.isNew && this.lastMessageId) {
            params["last"] = this.lastMessageId;
            params["recover"] = true;
        }
        return params;
    }
    markAsSubscribed() {
        this.isNew = false;
    }
}
class CentrifugoClient {
    constructor(options) {
        this.connectionStatus = "disconnected";
        this.isAlive = false;
        this.messageCounter = 0;
        this.subscribedChannels = new Map();
        this.heartbeatInterval = 30000;
        this.subscribeChannelsChunkSize = 100;
        this.reconnectInterval = 5000;
        this.path = options.path;
        this.tokenGenerator = new jscent_1.Token(options.secret);
        this.logger = options.logger;
        this.id = options.id;
        this.onMessageCallback = options.onMessageCallback;
        this.log = debug("centrifugo");
    }
    connect() {
        this.log("connect");
        this.connectionStatus = "connecting";
        this.ws = new WebSocket(this.path, {
            perMessageDeflate: false,
            handshakeTimeout: 1000,
        });
        this.ws.on("open", () => {
            this.sendConnectCommand();
        });
        this.ws.on("close", () => {
            this.connectionStatus = "disconnected";
            clearInterval(this.heartbeatTimer);
            this.logger.error("Centrifugo connection closed");
            this.reconnect();
        });
        this.ws.on("error", (error) => {
            this.logger.error("Centrifugo websocket error", error);
        });
        this.ws.on("message", (data) => {
            this.log(data);
            const decodedData = JSON.parse(data);
            if (Array.isArray(decodedData)) {
                decodedData.forEach((message) => this.processMessage(message));
            }
            else {
                this.processMessage(decodedData);
            }
        });
        return this;
    }
    subscribe(channel, lastMessageId) {
        this.connectIfDisconnected();
        this.unsubscribe(channel);
        const centrifugoChannel = new CentrifugoChannel(channel, lastMessageId);
        this.subscribedChannels.set(channel, centrifugoChannel);
        if (this.connectionStatus == "connected") {
            this.sendCommand(this.createSubscribeCommand(centrifugoChannel));
            centrifugoChannel.markAsSubscribed();
        }
        return this;
    }
    unsubscribe(channel) {
        if (this.subscribedChannels.has(channel)) {
            this.connectIfDisconnected();
            this.subscribedChannels.delete(channel);
            if (this.connectionStatus == "connected") {
                this.sendCommand(this.createCommand("unsubscribe", { channel }));
            }
        }
        return this;
    }
    getId() {
        return this.id;
    }
    setOnMessageCallback(onMessage) {
        this.onMessageCallback = onMessage;
        return this;
    }
    getOnMessageCallback() {
        return this.onMessageCallback;
    }
    connectIfDisconnected() {
        if (this.connectionStatus == "disconnected") {
            this.connect();
        }
        return this;
    }
    reconnect() {
        setTimeout(() => {
            this.log("reconnect");
            this.connect();
        }, this.reconnectInterval);
        return this;
    }
    batchSubscribe() {
        const subscribedChannels = this.subscribedChannels.values();
        let request = [];
        for (const subscribedChannel of subscribedChannels) {
            const command = this.createSubscribeCommand(subscribedChannel);
            request.push(command);
            subscribedChannel.markAsSubscribed();
            if (request.length === this.subscribeChannelsChunkSize) {
                this.sendCommand(request);
                request = [];
            }
        }
        if (request.length > 0) {
            this.sendCommand(request);
        }
    }
    heartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.isAlive === false) {
                return this.ws.terminate();
            }
            this.isAlive = false;
            this.sendCommand(this.createCommand("ping"));
        }, this.heartbeatInterval);
    }
    processMessage(message) {
        if (message.error) {
            this.logger.error("error", {
                error: message.error,
                channel: message.body.channel,
            });
            return;
        }
        switch (message.method) {
            case "connect":
                this.connectionStatus = "connected";
                this.isAlive = true;
                this.heartbeat();
                this.batchSubscribe();
                break;
            case "ping":
                this.isAlive = true;
                break;
            case "disconnect":
                this.logger.error("centrifugo disconnect. reason: " + message.body.reason);
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
    onMessage(channel, message) {
        if (this.onMessageCallback) {
            this.onMessageCallback(channel, message);
        }
        return this;
    }
    createSubscribeCommand(centrifugoChannel) {
        let params = centrifugoChannel.getParams();
        return this.createCommand("subscribe", params);
    }
    createCommand(method, params = null) {
        this.messageCounter++;
        return {
            method,
            params,
            uid: this.messageCounter.toString(),
        };
    }
    sendConnectCommand() {
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
    send(data) {
        return new Promise((resolve, reject) => {
            const encodedData = JSON.stringify(data);
            this.log(encodedData);
            this.ws.send(encodedData, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    sendCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.send(command);
            }
            catch (error) {
                this.logger.error("centrifugo websocket send error", error);
            }
        });
    }
}
exports.CentrifugoClient = CentrifugoClient;
//# sourceMappingURL=centrifugo-client.js.map