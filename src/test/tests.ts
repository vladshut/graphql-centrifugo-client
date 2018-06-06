/* tslint:disable:no-empty */
import * as chai from "chai";
import * as sinon from "sinon";
import { LoggerInstance } from "winston";
import * as WebSocket from "ws";
import {CentrifugoClient, ConnectionStatus} from "../centrifugo-client";

const now = new Date(1522070496648);

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

    function initCentrifugoClient(onMessage?: Function): CentrifugoClient {
        onMessage = onMessage || ((channel, message) => {});

        const centrifugoClientOptions = {
            path: "ws://localhost:7070/",
            id: "some_id",
            secret: "secret",
            onMessageCallback: onMessage,
            logger: {
                error: (msg: string, ...meta: any[]) => {},
            } as LoggerInstance
        };

        return new CentrifugoClient(centrifugoClientOptions);
    }

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

            initCentrifugoClient().subscribe('channel');
        });
    });

    describe("Centrifugo subscribe", () => {
        it("should subscribe to channel with last message id on disconnected client", (done) => {
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
                                    last: "1",
                                    messages: null,
                                    recovered: false,
                                },
                            }));

                            const expectedMessage = {
                                method: "subscribe",
                                params: {
                                    channel: "channel",
                                    last: "1",
                                    recover: true
                                },
                                uid: "2",
                            };

                            wss.close(() => done());

                            chai.expect(incomingMessage).to.deep.equal(expectedMessage);
                            break;
                    }
                });
            });

            initCentrifugoClient().subscribe('channel', '1');
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

            initCentrifugoClient(onMessage).subscribe('channel');
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

            initCentrifugoClient(onMessage).subscribe('channel');
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

                            centrifugo.unsubscribe('channel');

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

            const centrifugo = initCentrifugoClient().subscribe('channel');
        });
    });

    describe("Centrifugo close", () => {
        it("should close ws connection, set status to closed, set onMessageCallback to null", (done) => {
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

                            centrifugo.close();

                            break;
                    }
                });

                ws.on("close", () => {
                    chai.expect(centrifugo.getOnMessageCallback()).to.deep.equal(null);
                    chai.expect(centrifugo.getConnectionStatus()).to.deep.equal(ConnectionStatus.CLOSED);

                    done();
                });
            });

            const centrifugo = initCentrifugoClient();

            centrifugo.connect();
        });
    });
});
