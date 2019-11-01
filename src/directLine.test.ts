import * as DirectLineExport from "./directLine";
import { TestScheduler, Observable, BehaviorSubject, ReplaySubject, AsyncSubject, Subscription, Subscriber } from "rxjs";
import { AjaxCreationMethod, AjaxRequest, AjaxResponse } from "rxjs/observable/dom/AjaxObservable";
import { IScheduler } from "rxjs/Scheduler";
import { Action } from "rxjs/scheduler/Action";

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

interface MockServer {
    scheduler: TestScheduler;
    sockets: Set<WebSocket>;
    conversation: Array<DirectLineExport.Activity>;
}

const notImplemented = () => { throw new Error('not implemented') };

const mockAjax = (server: MockServer): AjaxCreationMethod => {

    const jax = (urlOrRequest: string | AjaxRequest): AjaxResponse => {
        if (typeof urlOrRequest !== 'string') {
            const { url } = urlOrRequest;
            console.log(url);
            const parts = url.split(/[\/\?]/);
            if (parts[5] === 'conversations') {
                if (parts[7] === 'activities') {
                    const activity: DirectLineExport.Activity = urlOrRequest.body;

                    const watermark = server.conversation.push(activity).toString();

                    const activityGroup: DirectLineExport.ActivityGroup = {
                        activities: [
                            activity
                        ],
                        watermark,
                    }
                    const message = new MessageEvent('type', { data: JSON.stringify(activityGroup) });

                    for (const socket of server.sockets) {
                        schedule(
                            server.scheduler,
                            () => socket.onmessage(message));
                    }

                    const response: Partial<AjaxResponse> = {
                        response: { id: 'messageId' },
                    }

                    return response as AjaxResponse;
                }
                else {
                    const conversation: DirectLineExport.Conversation = {
                        conversationId: 'conversationId',
                        token: 'token',
                        streamUrl: 'streamUrl',
                    };

                    const response: Partial<AjaxResponse> = {
                        response: conversation,
                    }

                    return response as AjaxResponse;
                }
            }
        }

        throw new Error();
    };

    const method = (urlOrRequest: string | AjaxRequest): Observable<AjaxResponse> =>
        new Observable<AjaxResponse>(subscriber => {
            schedule(
                server.scheduler,
                () => {
                    try {
                        subscriber.next(jax(urlOrRequest));
                        subscriber.complete();
                    }
                    catch (error) {
                        subscriber.error(error);
                    }
                });
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

type Work<T> = (this: Action<T>, state?: T) => void;
const schedule = (scheduler: IScheduler, ...works: Array<Work<undefined>>) => {
    for (const work of works) {
        scheduler.schedule(work);
    }
}

const mockWebSocket = (server: MockServer): WebSocketConstructor =>
    class MockWebSocket implements WebSocket {
        constructor(url: string, protocols?: string | string[]) {
            this.server = server;
            schedule(
                this.server.scheduler,
                () => this.readyState = WebSocket.CONNECTING,
                () => {
                    this.server.sockets.add(this);
                    this.onopen(new Event('open'));
                },
                () => this.readyState = WebSocket.OPEN);
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
            schedule(
                this.server.scheduler,
                () => this.readyState = WebSocket.CLOSING,
                () => {
                    this.onclose(new CloseEvent('close'))
                    this.server.sockets.delete(this);
                },
                () => this.readyState = WebSocket.CLOSED);
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

    const server: MockServer = {
        scheduler,
        sockets: new Set<WebSocket>(),
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
            // Observable.of(3).do(() => {
            //     server.sockets.forEach(s => s.onerror(new Event('error')))
            //     server.sockets.forEach(s => s.onclose(new CloseEvent('close')))
            // }),
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