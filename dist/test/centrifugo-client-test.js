"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai = require("chai");
const sinon = require("sinon");
const WebSocket = require("ws");
const centrifugo_client_1 = require("../centrifugo-client");
const now = new Date(1522070496648);
const hostname = "my-host-name";
describe("Centrifugo", () => {
    let sandbox;
    let clock;
    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        clock = sinon.useFakeTimers(now.getTime());
    });
    afterEach(() => {
        sandbox.restore();
        clock.restore();
    });
    describe("Centrifugo connect", () => {
        it("should connect to centrifugo on first subscribe", (done) => {
            const wss = new WebSocket.Server({ port: 7070 });
            wss.on("connection", function connection(ws) {
                ws.on("message", function incoming(message) {
                    let incomingMessage = JSON.parse(message.toString());
                    if (Array.isArray(incomingMessage)) {
                        incomingMessage = incomingMessage[0];
                    }
                    switch (incomingMessage.method) {
                        case "connect":
                            ws.send(JSON.stringify({
                                uid: "1",
                                method: "connect",
                                body: {
                                    version: "1.7.3",
                                    client: "4afc99b7-4066-41b7-adb9-d6a58d611e85",
                                    expires: false,
                                    expired: false,
                                    ttl: 0,
                                },
                            }));
                            const expectedMessage = {
                                method: "connect",
                                params: {
                                    user: hostname,
                                    info: "",
                                    timestamp: now.getTime().toString(),
                                    token: "e2e7eeef140772417da059eee1d40fc135ddb8b0ddcf0ffdcb014e4bd0e23fb9",
                                },
                                uid: "1",
                            };
                            chai.expect(incomingMessage).to.deep.equal(expectedMessage);
                            break;
                        case "subscribe":
                            ws.send(JSON.stringify({
                                uid: "2",
                                method: "subscribe",
                                body: {
                                    channel: "channel",
                                    status: true,
                                    last: "",
                                    messages: null,
                                    recovered: false,
                                },
                            }));
                            wss.close(() => done());
                            break;
                    }
                });
            });
            const centrifugoClientOptions = {
                path: "ws://localhost:7070/",
                id: "some_id",
                secret: "secret",
                onMessage: (channel, message) => { },
                logger: {
                    error: (msg, ...meta) => { },
                }
            };
            const centrifugo = new centrifugo_client_1.default(centrifugoClientOptions);
        });
    });
    describe("Centrifugo subscribe", () => {
        it("should subscribe to channel on disconnected client", (done) => {
            const wss = new WebSocket.Server({ port: 7070 });
            wss.on("connection", function connection(ws) {
                ws.on("message", function incoming(message) {
                    let incomingMessage = JSON.parse(message.toString());
                    if (Array.isArray(incomingMessage)) {
                        incomingMessage = incomingMessage[0];
                    }
                    switch (incomingMessage.method) {
                        case "connect":
                            ws.send(JSON.stringify({
                                uid: "1",
                                method: "connect",
                                body: {
                                    version: "1.7.3",
                                    client: "4afc99b7-4066-41b7-adb9-d6a58d611e85",
                                    expires: false,
                                    expired: false,
                                    ttl: 0,
                                },
                            }));
                            break;
                        case "subscribe":
                            ws.send(JSON.stringify({
                                uid: "2",
                                method: "subscribe",
                                body: {
                                    channel: "channel",
                                    status: true,
                                    last: "",
                                    messages: null,
                                    recovered: false,
                                },
                            }));
                            const expectedMessage = {
                                method: "subscribe",
                                params: {
                                    channel: "channel",
                                },
                                uid: "2",
                            };
                            wss.close(() => done());
                            chai.expect(incomingMessage).to.deep.equal(expectedMessage);
                            break;
                    }
                });
            });
            const centrifugoClientOptions = {
                path: "ws://localhost:7070/",
                id: "some_id",
                secret: "secret",
                onMessage: (channel, message) => { },
                logger: {
                    error: (msg, ...meta) => { },
                }
            };
            const centrifugo = new centrifugo_client_1.default(centrifugoClientOptions);
        });
        it("should emit message after subscribe to channel with history", (done) => {
            const wss = new WebSocket.Server({ port: 7070 });
            wss.on("connection", function connection(ws) {
                ws.on("message", function incoming(message) {
                    let incomingMessage = JSON.parse(message.toString());
                    if (Array.isArray(incomingMessage)) {
                        incomingMessage = incomingMessage[0];
                    }
                    switch (incomingMessage.method) {
                        case "connect":
                            ws.send(JSON.stringify({
                                uid: "1",
                                method: "connect",
                                body: {
                                    version: "1.7.3",
                                    client: "4afc99b7-4066-41b7-adb9-d6a58d611e85",
                                    expires: false,
                                    expired: false,
                                    ttl: 0,
                                },
                            }));
                            break;
                        case "subscribe":
                            ws.send(JSON.stringify({
                                uid: "2",
                                method: "subscribe",
                                body: {
                                    channel: "channel",
                                    status: true,
                                    last: "",
                                    messages: [
                                        {
                                            data: {
                                                id: 1,
                                            },
                                        },
                                    ],
                                    recovered: false,
                                },
                            }));
                            break;
                    }
                });
            });
            const onMessage = (channel, message) => {
                const expectedMessage = {
                    id: 1,
                };
                wss.close(() => done());
                chai.expect(message).to.deep.equal(expectedMessage);
            };
            const centrifugoClientOptions = {
                path: "ws://localhost:7070/",
                id: "some_id",
                secret: "secret",
                onMessage,
                logger: {
                    error: (msg, ...meta) => { },
                }
            };
            const centrifugo = new centrifugo_client_1.default(centrifugoClientOptions);
        });
    });
    describe("Centrifugo emit message", () => {
        it("should emit message", (done) => {
            const wss = new WebSocket.Server({ port: 7070 });
            wss.on("connection", function connection(ws) {
                ws.on("message", function incoming(message) {
                    let incomingMessage = JSON.parse(message.toString());
                    if (Array.isArray(incomingMessage)) {
                        incomingMessage = incomingMessage[0];
                    }
                    switch (incomingMessage.method) {
                        case "connect":
                            ws.send(JSON.stringify({
                                uid: "1",
                                method: "connect",
                                body: {
                                    version: "1.7.3",
                                    client: "4afc99b7-4066-41b7-adb9-d6a58d611e85",
                                    expires: false,
                                    expired: false,
                                    ttl: 0,
                                },
                            }));
                            break;
                        case "subscribe":
                            ws.send(JSON.stringify({
                                uid: "2",
                                method: "subscribe",
                                body: {
                                    channel: "channel",
                                    status: true,
                                    last: "",
                                    messages: null,
                                    recovered: false,
                                },
                            }));
                            ws.send(JSON.stringify({
                                method: "message",
                                body: {
                                    uid: "tOWKNrTjeEDNZzrQMrQ6Kp",
                                    channel: "channel",
                                    data: {
                                        participants: [],
                                        prizeFund: 1000,
                                    },
                                },
                            }));
                            break;
                    }
                });
            });
            const onMessage = (channel, message) => {
                const expectedMessage = {
                    participants: [],
                    prizeFund: 1000,
                };
                wss.close(() => done());
                chai.expect(message).to.deep.equal(expectedMessage);
            };
            const centrifugoClientOptions = {
                path: "ws://localhost:7070/",
                id: "some_id",
                secret: "secret",
                onMessage,
                logger: {
                    error: (msg, ...meta) => { },
                }
            };
            const centrifugo = new centrifugo_client_1.default(centrifugoClientOptions);
        });
    });
    describe("Centrifugo unsubscribe", () => {
        it("should unsubscribe from channel after listener removing", (done) => {
            const wss = new WebSocket.Server({ port: 7070 });
            wss.on("connection", function connection(ws) {
                ws.on("message", function incoming(message) {
                    let incomingMessage = JSON.parse(message.toString());
                    if (Array.isArray(incomingMessage)) {
                        incomingMessage = incomingMessage[0];
                    }
                    switch (incomingMessage.method) {
                        case "connect":
                            ws.send(JSON.stringify({
                                uid: "1",
                                method: "connect",
                                body: {
                                    version: "1.7.3",
                                    client: "4afc99b7-4066-41b7-adb9-d6a58d611e85",
                                    expires: false,
                                    expired: false,
                                    ttl: 0,
                                },
                            }));
                            break;
                        case "subscribe":
                            ws.send(JSON.stringify({
                                uid: "2",
                                method: "subscribe",
                                body: {
                                    channel: "channel",
                                    status: true,
                                    last: "",
                                    messages: null,
                                    recovered: false,
                                },
                            }));
                            break;
                        case "unsubscribe":
                            ws.send(JSON.stringify({
                                uid: "2",
                                method: "unsubscribe",
                                body: {
                                    channel: "channel",
                                    status: true,
                                    last: "",
                                    messages: null,
                                    recovered: false,
                                },
                            }));
                            const expectedMessage = {
                                method: "unsubscribe",
                                params: {
                                    channel: "channel",
                                },
                                uid: "3",
                            };
                            wss.close(() => done());
                            chai.expect(incomingMessage).to.deep.equal(expectedMessage);
                            break;
                    }
                });
            });
            const onMessage = (channel, message) => { };
            const centrifugoClientOptions = {
                path: "ws://localhost:7070/",
                id: "some_id",
                secret: "secret",
                onMessage,
                logger: {
                    error: (msg, ...meta) => { },
                }
            };
            const centrifugo = new centrifugo_client_1.default(centrifugoClientOptions);
        });
    });
});
//# sourceMappingURL=centrifugo-client-test.js.map