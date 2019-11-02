import * as DirectLineExport from "./directLine";
import { TestScheduler, Observable, Subscription } from "rxjs";
import { AjaxCreationMethod, AjaxRequest, AjaxResponse } from "rxjs/observable/dom/AjaxObservable";
import { IScheduler } from "rxjs/Scheduler";
import { Action } from "rxjs/scheduler/Action";
import { URL, URLSearchParams } from 'url';

declare var process: {
    arch: string;
    env: {
        VERSION: string;
    };
    platform: string;
    release: string;
    version: string;
};

test("#setConnectionStatusFallback", () => {
    const { DirectLine } = DirectLineExport;
    expect(typeof DirectLine.prototype.setConnectionStatusFallback).toBe("function")
    const { setConnectionStatusFallback } = DirectLine.prototype;
    const testFallback = setConnectionStatusFallback(0, 1);
    let idx = 4;
    while (idx--) {
        expect(testFallback(0)).toBe(0);
    }
    // fallback will be triggered
    expect(testFallback(0)).toBe(1);
    idx = 4;
    while (idx--) {
        expect(testFallback(0)).toBe(0);
    }
    expect(testFallback(0)).toBe(1);
});

describe("#commonHeaders", () => {
    const botAgent = "DirectLine/3.0 (directlinejs; custom-bot-agent)";
    let botConnection;

    beforeEach(() => {
        global.process.env.VERSION = "test-version";
        const { DirectLine } = DirectLineExport;
        botConnection = new DirectLine({ token: "secret-token", botAgent: "custom-bot-agent" });
    });

    test('appends browser user agent when in a browser', () => {
        // @ts-ignore
        expect(botConnection.commonHeaders()).toEqual({
            "Authorization": "Bearer secret-token",
            "x-ms-bot-agent": botAgent
        });
    })

    test.skip('appends node environment agent when in node', () => {
        // @ts-ignore
        delete window.navigator
        // @ts-ignore
        const os = require('os');
        const { arch, platform, version } = process;

        // @ts-ignore
        expect(botConnection.commonHeaders()).toEqual({
            "Authorization": "Bearer secret-token",
            "User-Agent": `${botAgent} (Node.js,Version=${version}; ${platform} ${os.release()}; ${arch})`,
            "x-ms-bot-agent": botAgent
        });
    })
});

interface ActivitySocket {
    play: (start: number, after: number) => void;
}

interface MockServer {
    scheduler: TestScheduler;
    sockets: Set<WebSocket & ActivitySocket>;
    conversation: Array<DirectLineExport.Activity>;
}

const notImplemented = () => { throw new Error('not implemented') };

const keyWatermark = 'watermark';

const mockAjax = (server: MockServer): AjaxCreationMethod => {

    const uriBase = new URL('https://directline.botframework.com/v3/directline/');
    const createStreamUrl = (watermark: number): string => {
        const uri = new URL('conversations/stream', uriBase);
        if (watermark > 0) {
            const params = new URLSearchParams();
            params.append(keyWatermark, watermark.toString(10));
            uri.search = params.toString();
        }

        return uri.toString();
    }

    const jax = (urlOrRequest: string | AjaxRequest): AjaxResponse => {
        if (typeof urlOrRequest === 'string') {
            throw new Error();
        }

        console.log(`${urlOrRequest.method}: ${urlOrRequest.url}`);
        const uri = new URL(urlOrRequest.url);

        const { pathname, searchParams } = uri;

        const conversationId = 'SingleConversation';
        const token = 'token';

        const parts = pathname.split('/');

        if (parts[3] === 'tokens' && parts[4] === 'refresh') {

            const response: Partial<AjaxResponse> = {
                response: { token }
            };

            return response as AjaxResponse;
        }

        if (parts[3] !== 'conversations') {
            throw new Error();
        }

        if (parts.length === 4) {
            const conversation: DirectLineExport.Conversation = {
                conversationId,
                token,
                streamUrl: createStreamUrl(0),
            };

            const response: Partial<AjaxResponse> = {
                response: conversation,
            }

            return response as AjaxResponse;
        }

        if (parts[4] !== conversationId) {
            throw new Error();
        }

        if (parts[5] === 'activities') {
            const activity: DirectLineExport.Activity = urlOrRequest.body;

            const after = server.conversation.push(activity);
            const start = after - 1;

            for (const socket of server.sockets) {
                socket.play(start, after);
            }

            const response: Partial<AjaxResponse> = {
                response: { id: 'messageId' },
            }

            return response as AjaxResponse;
        }
        else if (parts.length === 5) {
            const watermark = searchParams.get('watermark');
            const start = Number.parseInt(watermark, 10);

            const conversation: DirectLineExport.Conversation = {
                conversationId,
                token,
                streamUrl: createStreamUrl(start),
            };

            const response: Partial<AjaxResponse> = {
                response: conversation,
            }

            return response as AjaxResponse;
        }

        throw new Error();
    };

    const method = (urlOrRequest: string | AjaxRequest): Observable<AjaxResponse> =>
        new Observable<AjaxResponse>(subscriber => {
            try {
                subscriber.next(jax(urlOrRequest));
                subscriber.complete();
            }
            catch (error) {
                subscriber.error(error);
            }
        });

    type ValueType<T, V> = {
        [K in keyof T]: T[K] extends V ? T[K] : never;
    }

    type Properties = ValueType<AjaxCreationMethod, Function>;

    const properties: Properties = {
        get: (url: string, headers?: Object): Observable<AjaxResponse> => notImplemented(),
        post: (url: string, body?: any, headers?: Object): Observable<AjaxResponse> => notImplemented(),
        put: (url: string, body?: any, headers?: Object): Observable<AjaxResponse> => notImplemented(),
        patch: (url: string, body?: any, headers?: Object): Observable<AjaxResponse> => notImplemented(),
        delete: (url: string, headers?: Object): Observable<AjaxResponse> => notImplemented(),
        getJSON: (url: string, headers?: Object) => notImplemented(),
    };

    return Object.assign(method, properties);
}

type WebSocketConstructor = typeof WebSocket;
type EventHandler<E extends Event> = (this: WebSocket, ev: E) => any;

const mockWebSocket = (server: MockServer): WebSocketConstructor =>
    class MockWebSocket implements WebSocket, ActivitySocket {
        constructor(url: string, protocols?: string | string[]) {
            this.server = server;

            server.scheduler.schedule(() => {
                this.readyState = WebSocket.CONNECTING;
                this.server.sockets.add(this);
                this.onopen(new Event('open'));
                this.readyState = WebSocket.OPEN;
                const uri = new URL(url);
                const watermark = uri.searchParams.get(keyWatermark)
                if (watermark !== null) {
                    const start = Number.parseInt(watermark, 10);
                    this.play(start, this.server.conversation.length);
                }
            });
        }

        play(start: number, after: number) {

            const { conversation } = this.server;
            const activities = conversation.slice(start, after);
            const watermark = conversation.length.toString();
            const activityGroup: DirectLineExport.ActivityGroup = {
                activities,
                watermark,
            }

            const message = new MessageEvent('type', { data: JSON.stringify(activityGroup) });

            this.onmessage(message);
        }

        private readonly server: MockServer;

        binaryType: BinaryType = 'arraybuffer';
        readonly bufferedAmount: number = 0;
        readonly extensions: string = '';
        readonly protocol: string = 'https';
        readyState: number = WebSocket.CLOSED;
        readonly url: string = '';
        readonly CLOSED: number = WebSocket.CLOSED;
        readonly CLOSING: number = WebSocket.CLOSING;
        readonly CONNECTING: number = WebSocket.CONNECTING;
        readonly OPEN: number = WebSocket.OPEN;

        onclose: EventHandler<CloseEvent>;
        onerror: EventHandler<Event>;
        onmessage: EventHandler<MessageEvent>;
        onopen: EventHandler<Event>;

        close(code?: number, reason?: string): void {
            this.readyState = WebSocket.CLOSING;
            this.onclose(new CloseEvent('close'))
            this.server.sockets.delete(this);
            this.readyState = WebSocket.CLOSED;
        }

        send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        }

        addEventListener() { throw new Error(); }
        removeEventListener() { throw new Error(); }
        dispatchEvent(): boolean { throw new Error(); }

        static CLOSED = WebSocket.CLOSED;
        static CLOSING = WebSocket.CLOSING;
        static CONNECTING = WebSocket.CONNECTING;
        static OPEN = WebSocket.OPEN;
    };

test('TestWithMocks', () => {

    const { DirectLine } = DirectLineExport;

    // setup

    const scheduler = new TestScheduler((actual, expected) =>
        expect(expected).toBe(actual));

    scheduler.maxFrames = 60 * 1000;

    const server: MockServer = {
        scheduler,
        sockets: new Set<WebSocket & ActivitySocket>(),
        conversation: [],
    };

    const makeActivity = (text: string): DirectLineExport.Activity => ({ type: 'message', from: { id: 'sender' }, text });

    const expected = {
        x: makeActivity('x'),
        y: makeActivity('y'),
    };

    // arrange

    const options: DirectLineExport.Services = {
        scheduler,
        WebSocket: mockWebSocket(server),
        ajax: mockAjax(server),
    };

    const directline = new DirectLine(options);

    const subscriptions: Array<Subscription> = [];

    try {

        // const activity$ = scheduler.createColdObservable<DirectLineExport.Activity>('--x--y--|', expected);
        // subscriptions.push(activity$.flatMap(a =>
        //     directline.postActivity(a)).observeOn(scheduler).subscribe());

        const scenario = [
            Observable.empty().delay(200, scheduler),
            directline.postActivity(expected.x),
            Observable.of(3).do(() => {
                server.sockets.forEach(s => s.onclose(new CloseEvent('close')))
            }),
            Observable.empty().delay(200, scheduler),
            directline.postActivity(expected.y),
            Observable.empty().delay(200, scheduler),
        ];

        subscriptions.push(Observable.concat(...scenario, scheduler).observeOn(scheduler).subscribe());

        const actual: Array<DirectLineExport.Activity> = [];
        subscriptions.push(directline.activity$.subscribe(a => {
            actual.push(a);
        }));

        // scheduler.expectObservable(directline.activity$).toBe('--x--y--|', activities);

        // act

        scheduler.flush();

        // if (scheduler.actions.length > 0) {
        //     throw new Error();
        // }

        // assert

        expect(actual).toStrictEqual([expected.x, expected.y]);
    }
    finally {
        // cleanup

        for (const subscription of subscriptions) {
            subscription.unsubscribe();
        }
    }
});