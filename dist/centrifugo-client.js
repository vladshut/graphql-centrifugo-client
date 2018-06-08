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
const jscent_1 = require("jscent");
const uuid_1 = require("uuid");
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
        this.isClosed = false;
        this.connectionStatus = "DISCONNECTED";
        this.isAlive = false;
        this.messageCounter = 0;
        this.subscribedChannels = new Map();
        this.heartbeatInterval = 30000;
        this.subscribeChannelsChunkSize = 100;
        this.reconnectInterval = 5000;
        this.path = options.path;
        this.tokenGenerator = new jscent_1.Token(options.secret);
        this.logger = options.logger;
        this.id = uuid_1.v4();
        this.onMessageCallback = options.onMessageCallback;
    }
    connect() {
        if (!this.setConnectionStatus("CONNECTING")) {
            return this;
        }
        this.initWebSocket();
        return this;
    }
    subscribe(channel, lastMessageId) {
        this.isClosed = false;
        this.connect();
        this.unsubscribe(channel);
        const centrifugoChannel = new CentrifugoChannel(channel, lastMessageId);
        this.subscribedChannels.set(channel, centrifugoChannel);
        if (this.connectionStatus == "CONNECTED") {
            this.sendCommand(this.createSubscribeCommand(centrifugoChannel));
            centrifugoChannel.markAsSubscribed();
        }
        return this;
    }
    unsubscribe(channel) {
        if (this.subscribedChannels.has(channel)) {
            this.connect();
            this.subscribedChannels.delete(channel);
            if (this.connectionStatus == "CONNECTED") {
                this.sendCommand(this.createCommand("unsubscribe", { channel }));
            }
        }
        return this;
    }
    setOnMessageCallback(onMessage) {
        this.onMessageCallback = onMessage;
        return this;
    }
    getOnMessageCallback() {
        return this.onMessageCallback;
    }
    close() {
        if (this.connectionStatus === "CONNECTED") {
            this.sendCommand(this.createCommand('disconnect'));
        }
        this.isClosed = true;
        this.onMessageCallback = null;
        this.setConnectionStatus("DISCONNECTED");
        clearInterval(this.heartbeatTimer);
        this.ws.close();
        this.ws = null;
    }
    initWebSocket() {
        this.ws = new WebSocket(this.path, {
            perMessageDeflate: false,
            handshakeTimeout: 1000,
        });
        this.ws.on("open", () => {
            this.sendConnectCommand();
        });
        this.ws.on("close", () => {
            if (!this.isClosed) {
                this.setConnectionStatus("DISCONNECTED");
                this.logError("Centrifugo connection closed");
                this.reconnect();
            }
        });
        this.ws.on("error", (error) => {
            this.logError("Centrifugo websocket error", error);
        });
        this.ws.on("message", (data) => {
            this.logMessage("<- " + data);
            const decodedData = JSON.parse(data);
            if (Array.isArray(decodedData)) {
                decodedData.forEach((message) => this.processMessage(message));
            }
            else {
                this.processMessage(decodedData);
            }
        });
    }
    logMessage(message, data = {}) {
        this.logger.debug("centrifugo client " + message, data);
    }
    logError(message, data = {}) {
        this.logger.error("centrifugo client ERROR " + message, data);
    }
    logCantChangeStatusTo(to, reason = "") {
        this.logMessage("!! Cant change status from '" + this.connectionStatus + "' to '" + to + "'. " + reason);
    }
    setConnectionStatus(status) {
        if (this.isClosed && status !== "DISCONNECTED") {
            this.logCantChangeStatusTo(status, "Client is closed.");
            return false;
        }
        if (status === "CONNECTING" && this.connectionStatus !== "DISCONNECTED") {
            this.logCantChangeStatusTo(status, "Transition failed.");
            return false;
        }
        this.logMessage("!! Change status from '" + this.connectionStatus + "' to '" + status + "'");
        this.connectionStatus = status;
        return true;
    }
    reconnect() {
        setTimeout(() => {
            this.logMessage("!! reconnect");
            this.connect();
        }, this.reconnectInterval);
        return this;
    }
    batchSubscribe() {
        const subscribedChannels = this.subscribedChannels.values();
        let commands = [];
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
    heartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.isAlive === false) {
                return this.ws.terminate();
            }
            this.isAlive = false;
            this.sendPingCommand();
        }, this.heartbeatInterval);
    }
    sendPingCommand() {
        const command = this.createCommand("ping");
        this.sendCommand(command);
    }
    processMessage(message) {
        if (message.error) {
            this.logError("error", {
                error: message.error,
                channel: message.body.channel,
            });
            return;
        }
        switch (message.method) {
            case "connect":
                if (!this.setConnectionStatus("CONNECTED")) {
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
    onMessage(channel, message) {
        if (this.onMessageCallback) {
            this.onMessageCallback(channel, message);
        }
    }
    createSubscribeCommand(centrifugoChannel) {
        let params = centrifugoChannel.getParams();
        return this.createCommand("subscribe", params);
    }
    createCommand(method, params = null) {
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
            this.logMessage("-> " + encodedData);
            if (this.isClosed) {
                return resolve();
            }
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
                this.logError("WebSocket send error", error);
            }
        });
    }
}
exports.CentrifugoClient = CentrifugoClient;
//# sourceMappingURL=centrifugo-client.js.map