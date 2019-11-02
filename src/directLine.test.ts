import * as DirectLineExport from "./directLine";
import * as DirectLineMock from './directLine.mock';
import { TestScheduler, Observable, Subscription } from "rxjs";

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

test('TestWithMocks', () => {

    const { DirectLine } = DirectLineExport;

    // setup

    const scheduler = new TestScheduler((actual, expected) =>
        expect(expected).toBe(actual));

    scheduler.maxFrames = 60 * 1000;

    const server: DirectLineMock.Server = {
        scheduler,
        sockets: new Set<DirectLineMock.Socket>(),
        conversation: [],
        token: 'tokenA',
    };

    const makeActivity = (text: string): DirectLineExport.Activity => ({ type: 'message', from: { id: 'sender' }, text });

    const expected = {
        x: makeActivity('x'),
        y: makeActivity('y'),
    };

    // arrange

    const options: DirectLineExport.Services = {
        scheduler,
        WebSocket: DirectLineMock.mockWebSocket(server),
        ajax: DirectLineMock.mockAjax(server),
        random: () => 0,
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