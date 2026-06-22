/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

import * as DirectLineExport from "./directLine";
import * as DirectLineMock from './directLine.mock';
import { TestScheduler, Observable, Subscription, AjaxResponse } from "rxjs";
// @ts-ignore
import { version } from "../package.json";

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
    const botAgent = `DirectLine/3.0 (directlinejs; custom-bot-agent ${version})`;
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

describe('MockSuite', () => {

    const lazyConcat = <T>(items: Iterable<Observable<T>>): Observable<T> =>
        new Observable<T>(subscriber => {
            const iterator = items[Symbol.iterator]();
            let inner: Subscription | undefined;

            const pump = () => {
                try {
                    const result = iterator.next();
                    if (result.done === true) {
                        subscriber.complete();
                    }
                    else {
                        inner = result.value.subscribe(
                            value => subscriber.next(value),
                            error => subscriber.error(error),
                            pump
                        );
                    }
                }
                catch (error) {
                    subscriber.error(error);
                }
            };

            pump();

            return () => {
                if (typeof inner !== 'undefined') {
                    inner.unsubscribe();
                }
            };
        });

    let scheduler: TestScheduler;
    let server: DirectLineMock.Server;
    let services: DirectLineExport.Services;
    let subscriptions: Array<Subscription>;
    let directline: DirectLineExport.DirectLine;

    beforeEach(() => {
        scheduler = new TestScheduler((actual, expected) => expect(expected).toBe(actual));
        scheduler.maxFrames = 60 * 1000;
        server = DirectLineMock.mockServer(scheduler);
        services = DirectLineMock.mockServices(server, scheduler);
        directline = new DirectLineExport.DirectLine(services);
        subscriptions = [];
    });

    afterEach(() => {
        for (const subscription of subscriptions) {
            subscription.unsubscribe();
        }
    })

    const expected = {
        x: DirectLineMock.mockActivity('x'),
        y: DirectLineMock.mockActivity('y'),
        z: DirectLineMock.mockActivity('z'),
    };

    test('HappyPath', () => {
        // arrange

        const scenario = function* (): IterableIterator<Observable<unknown>> {
            yield Observable.timer(200, scheduler);
            yield directline.postActivity(expected.x);
            yield Observable.timer(200, scheduler);
            yield directline.postActivity(expected.y);
            yield Observable.timer(200, scheduler);
        };

        subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

        const actual: Array<DirectLineExport.Activity> = [];
        subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

        // act

        scheduler.flush();

        // assert

        expect(actual).toStrictEqual([expected.x, expected.y]);
    });

    test('ReconnectOnClose', () => {
        // arrange

        const scenario = function* (): IterableIterator<Observable<unknown>> {
            yield Observable.timer(200, scheduler);
            yield directline.postActivity(expected.x);
            DirectLineMock.injectClose(server);
            yield Observable.timer(200, scheduler);
            yield directline.postActivity(expected.y);
            yield Observable.timer(200, scheduler);
        };

        subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

        const actual: Array<DirectLineExport.Activity> = [];
        subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

        // act

        scheduler.flush();

        // assert

        expect(actual).toStrictEqual([expected.x, expected.y]);
    });

    test('BotAgentWithMocks', () => {
        const expected: string = `DirectLine/3.0 (directlinejs ${version})`;

        //@ts-ignore
        const actual: string = directline.commonHeaders()["x-ms-bot-agent"];
        expect(actual).toStrictEqual(expected)
    });

    test('RetryAfterHeader', () => {
        services.ajax = DirectLineMock.mockAjax(server, (urlOrRequest) => {

            if(typeof urlOrRequest === 'string'){
                throw new Error();
            }

            if(urlOrRequest.url && urlOrRequest.url.indexOf(server.conversation.conversationId)>0){
                 const response: Partial<AjaxResponse> = {
                    status: 429,
                    xhr:{
                        getResponseHeader: (name) => "10"
                    } as XMLHttpRequest
                };
                const error = new Error('Ajax Error');
                throw Object.assign(error, response);
            }
            else if(urlOrRequest.url && urlOrRequest.url.indexOf('/conversations') > 0){
                // start conversation
                const response: Partial<AjaxResponse> = {
                    response: server.conversation,
                    status: 201,
                    xhr: {
                        getResponseHeader: (name) => 'n/a'
                    } as XMLHttpRequest
                };
                return response as AjaxResponse;
            }
            throw new Error();
        });
        directline = new DirectLineExport.DirectLine(services);

        let startTime: number;
        let endTime: number;
        const scenario = function* (): IterableIterator<Observable<unknown>> {
            yield Observable.timer(200, scheduler);
            startTime = scheduler.now();
            yield directline.postActivity(expected.x);
        };

        let actualError: Error;
        try{
        subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
        scheduler.flush();
        }
        catch(error){
            actualError = error;
            endTime = scheduler.now();
        }
        expect(actualError.message).toStrictEqual('Ajax Error');
        // @ts-ignore
        expect(actualError.status).toStrictEqual(429);
        expect(endTime - startTime).toStrictEqual(10);
    });

    describe('StreamingMode', () => {

        test('Setting streaming adds deliveryMode=stream to outgoing activity', () => {
            // override directline with streaming enabled
            directline = new DirectLineExport.DirectLine({ ...services, streaming: true });

            const streamingActivity = DirectLineMock.mockActivity('streaming-test');
            const scenario = function* (): IterableIterator<Observable<unknown>> {
                yield Observable.timer(200, scheduler);
                yield directline.postActivity(streamingActivity);
            };

            subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

            const actual: Array<DirectLineExport.Activity> = [];
            subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

            scheduler.flush();

            expect(streamingActivity.deliveryMode).toStrictEqual('stream');
            expect(actual[0].deliveryMode).toStrictEqual('stream');
        });

        test('Not setting streaming does not add deliveryMode at all to outgoing activity', () => {
            const normalActivity = DirectLineMock.mockActivity('normal-test');
            const scenario = function* (): IterableIterator<Observable<unknown>> {
                yield Observable.timer(200, scheduler);
                yield directline.postActivity(normalActivity);
            };

            subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

            const actual: Array<DirectLineExport.Activity> = [];
            subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

            scheduler.flush();

            expect(normalActivity.deliveryMode).toBeUndefined();
            expect(actual[0].deliveryMode).toBeUndefined();
        });

        test('Setting streaming overrides passed deliveryMode "normal" in activity to "stream"', () => {
            directline = new DirectLineExport.DirectLine({ ...services, streaming: true });

            const presetActivity: DirectLineExport.Message = {
                type: 'message',
                from: { id: 'sender' },
                text: 'preset',
                deliveryMode: 'normal'
            };

            const scenario = function* (): IterableIterator<Observable<unknown>> {
                yield Observable.timer(200, scheduler);
                yield directline.postActivity(presetActivity);
            };

            subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

            const actual: Array<DirectLineExport.Activity> = [];
            subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

            scheduler.flush();

            expect(presetActivity.deliveryMode).toStrictEqual('stream');
            expect(actual[0].deliveryMode).toStrictEqual('stream');
        });

        test('Not setting streaming preserves passed deliveryMode "normal" in activity', () => {
            const presetActivity: DirectLineExport.Message = {
                type: 'message',
                from: { id: 'sender' },
                text: 'preset-nonstream',
                deliveryMode: 'normal'
            };

            const scenario = function* (): IterableIterator<Observable<unknown>> {
                yield Observable.timer(200, scheduler);
                yield directline.postActivity(presetActivity);
            };

            subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

            const actual: Array<DirectLineExport.Activity> = [];
            subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

            scheduler.flush();

            expect(presetActivity.deliveryMode).toStrictEqual('normal');
            expect(actual[0].deliveryMode).toStrictEqual('normal');
        });

        test.each([
            { streaming: true, expectedDeliveryMode: 'stream', testName: 'Streaming' },
            { streaming: false, expectedDeliveryMode: undefined, testName: 'Non-streaming' }
        ])('$testName + 403 post returns retry and preserves deliveryMode', ({ streaming, expectedDeliveryMode }) => {
            services.ajax = DirectLineMock.mockAjax(server, (urlOrRequest) => {
                if (typeof urlOrRequest === 'string') {
                    throw new Error();
                }

                if (urlOrRequest.url && urlOrRequest.url.indexOf('/conversations') > 0 && !/activities/u.test(urlOrRequest.url)) {
                    // start conversation
                    const response: Partial<AjaxResponse> = {
                        response: server.conversation,
                        status: 201,
                        xhr: { getResponseHeader: () => 'n/a' } as unknown as XMLHttpRequest
                    };
                    return response as AjaxResponse;
                }

                if (urlOrRequest.url && /activities/u.test(urlOrRequest.url)) {
                    const response: Partial<AjaxResponse> = {
                        status: 403,
                        xhr: { getResponseHeader: () => 'n/a' } as unknown as XMLHttpRequest
                    };
                    const error = new Error('Forbidden');
                    throw Object.assign(error, response);
                }

                throw new Error();
            });

            directline = new DirectLineExport.DirectLine({
                ...services,
                ...(streaming ? { streaming: true } : {})
            });

            const retryActivity = DirectLineMock.mockActivity('will-retry');
            const scenario = function* (): IterableIterator<Observable<unknown>> {
                yield Observable.timer(200, scheduler);
                yield directline.postActivity(retryActivity);
            };

            let postResult: string | undefined;
            subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe({
                next: v => { postResult = v as string; },
                error: () => {},
                complete: () => {}
            }));

            scheduler.flush();

            expect(retryActivity.deliveryMode).toStrictEqual(expectedDeliveryMode);
            expect(postResult).toStrictEqual('retry');
        });
    });

    describe('VoiceMode', () => {

        describe('enableVoiceMode: true (explicit)', () => {

            test('voice mode enabled and uses /stream/multimodal URL', () => {
                directline = new DirectLineExport.DirectLine({ ...services, enableVoiceMode: true });

                // Verify voice mode is enabled synchronously
                expect(directline.getIsVoiceModeEnabled()).toBe(true);

                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                subscriptions.push(directline.activity$.subscribe());

                scheduler.flush();

                // Verify WebSocket URL contains /stream/multimodal
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(true);
            });

            test('postActivity sends via WebSocket (does not echo back)', () => {
                directline = new DirectLineExport.DirectLine({ ...services, enableVoiceMode: true });

                const textActivity = DirectLineMock.mockActivity('hello-voice-mode');

                let postCompleted = false;
                const actual: Array<DirectLineExport.Activity> = [];

                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                    yield directline.postActivity(textActivity).do(() => postCompleted = true);
                    yield Observable.timer(100, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

                scheduler.flush();

                expect(postCompleted).toBe(true);
                // WebSocket path: activity does NOT echo back (server doesn't broadcast WS-sent activities)
                expect(actual).not.toContainEqual(textActivity);
            });

            test('reconnect after WebSocket close still uses /stream/multimodal URL', () => {
                directline = new DirectLineExport.DirectLine({ ...services, enableVoiceMode: true });

                // First verify initial connection uses multimodal URL
                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                subscriptions.push(directline.activity$.subscribe());

                scheduler.flush();

                // Verify initial connection uses multimodal
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(true);

                // Simulate WebSocket close (triggers reconnect)
                DirectLineMock.injectClose(server);

                // Continue scheduler to allow reconnect
                const reconnectScenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                };

                subscriptions.push(lazyConcat(reconnectScenario()).observeOn(scheduler).subscribe());

                scheduler.flush();

                // After reconnect, should still use /stream/multimodal URL
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(true);
                expect(directline.getIsVoiceModeEnabled()).toBe(true);
            });
        });

        describe('enableVoiceMode: false (explicit)', () => {

            test('voice mode disabled and uses standard /stream URL', () => {
                directline = new DirectLineExport.DirectLine({ ...services, enableVoiceMode: false });

                // Verify voice mode is disabled
                expect(directline.getIsVoiceModeEnabled()).toBe(false);

                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                subscriptions.push(directline.activity$.subscribe());

                scheduler.flush();

                // Verify WebSocket URL does NOT contain /stream/multimodal
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(false);
            });

            test('postActivity sends via HTTP (echoes back)', () => {
                directline = new DirectLineExport.DirectLine({ ...services, enableVoiceMode: false });

                const textActivity = DirectLineMock.mockActivity('hello-http');

                const actual: Array<DirectLineExport.Activity> = [];
                subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                    yield directline.postActivity(textActivity);
                    yield Observable.timer(100, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

                scheduler.flush();

                // HTTP path: activity echoes back via activity$ (server broadcasts HTTP-posted activities)
                expect(actual).toContainEqual(textActivity);
            });

            test('403 post returns retry and still uses standard /stream URL', () => {
                services.ajax = DirectLineMock.mockAjax(server, (urlOrRequest) => {
                    if (typeof urlOrRequest === 'string') {
                        throw new Error();
                    }

                    if (urlOrRequest.url && urlOrRequest.url.indexOf('/conversations') > 0 && !/activities/u.test(urlOrRequest.url)) {
                        const response: Partial<AjaxResponse> = {
                            response: server.conversation,
                            status: 201,
                            xhr: { getResponseHeader: () => 'n/a' } as unknown as XMLHttpRequest
                        };
                        return response as AjaxResponse;
                    }

                    if (urlOrRequest.url && /activities/u.test(urlOrRequest.url)) {
                        const response: Partial<AjaxResponse> = {
                            status: 403,
                            xhr: { getResponseHeader: () => 'n/a' } as unknown as XMLHttpRequest
                        };
                        const error = new Error('Forbidden');
                        throw Object.assign(error, response);
                    }

                    throw new Error();
                });

                directline = new DirectLineExport.DirectLine({ ...services, enableVoiceMode: false });

                const retryActivity = DirectLineMock.mockActivity('will-retry-false');
                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                    yield directline.postActivity(retryActivity);
                };

                let postResult: string | undefined;
                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe({
                    next: v => { postResult = v as string; },
                    error: () => {},
                    complete: () => {}
                }));

                scheduler.flush();

                expect(postResult).toStrictEqual('retry');
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(false);
            });
        });

        describe('enableVoiceMode: undefined (auto-detect)', () => {

            test('non-iframe: voice mode disabled and uses standard /stream URL', () => {
                // Default test environment is not an iframe (window.self === window.top)
                directline = new DirectLineExport.DirectLine({ ...services });

                // Verify voice mode is disabled (synchronous - no iframe check needed)
                expect(directline.getIsVoiceModeEnabled()).toBe(false);

                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                subscriptions.push(directline.activity$.subscribe());

                scheduler.flush();

                // Verify standard /stream URL (not multimodal)
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(false);
            });

            test('non-iframe: 403 post returns retry and still uses standard /stream URL', () => {
                services.ajax = DirectLineMock.mockAjax(server, (urlOrRequest) => {
                    if (typeof urlOrRequest === 'string') {
                        throw new Error();
                    }

                    if (urlOrRequest.url && urlOrRequest.url.indexOf('/conversations') > 0 && !/activities/u.test(urlOrRequest.url)) {
                        const response: Partial<AjaxResponse> = {
                            response: server.conversation,
                            status: 201,
                            xhr: { getResponseHeader: () => 'n/a' } as unknown as XMLHttpRequest
                        };
                        return response as AjaxResponse;
                    }

                    if (urlOrRequest.url && /activities/u.test(urlOrRequest.url)) {
                        const response: Partial<AjaxResponse> = {
                            status: 403,
                            xhr: { getResponseHeader: () => 'n/a' } as unknown as XMLHttpRequest
                        };
                        const error = new Error('Forbidden');
                        throw Object.assign(error, response);
                    }

                    throw new Error();
                });

                directline = new DirectLineExport.DirectLine({ ...services });

                const retryActivity = DirectLineMock.mockActivity('will-retry-undefined');
                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                    yield directline.postActivity(retryActivity);
                };

                let postResult: string | undefined;
                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe({
                    next: v => { postResult = v as string; },
                    error: () => {},
                    complete: () => {}
                }));

                scheduler.flush();

                expect(postResult).toStrictEqual('retry');
                expect(DirectLineMock.hasMultimodalUrl(server)).toBe(false);
            });

            test('iframe WITH microphone permission: voice mode enabled and uses /stream/multimodal URL', async () => {
                // Mock iframe detection: window.self !== window.top
                const originalSelf = window.self;
                Object.defineProperty(window, 'self', {
                    value: { notTop: true },
                    writable: true,
                    configurable: true
                });

                // Mock permissionsPolicy.allowsFeature('microphone') to return true
                const originalPermissionsPolicy = (document as any).permissionsPolicy;
                (document as any).permissionsPolicy = {
                    allowsFeature: (feature: string) => feature === 'microphone'
                };

                try {
                    directline = new DirectLineExport.DirectLine({ ...services });
                    await Promise.resolve();

                    const textActivity = DirectLineMock.mockActivity('iframe-with-mic');
                    let postCompleted = false;
                    const actual: Array<DirectLineExport.Activity> = [];

                    const scenario = function* (): IterableIterator<Observable<unknown>> {
                        yield Observable.timer(200, scheduler);
                        yield directline.postActivity(textActivity).do(() => postCompleted = true);
                        yield Observable.timer(100, scheduler);
                    };

                    subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                    subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

                    scheduler.flush();

                    expect(directline.getIsVoiceModeEnabled()).toBe(true);

                    // Verify /stream/multimodal URL
                    expect(DirectLineMock.hasMultimodalUrl(server)).toBe(true);
                    // Verify WebSocket routing: activity does NOT echo back
                    expect(postCompleted).toBe(true);
                    expect(actual).not.toContainEqual(textActivity);
                } finally {
                    Object.defineProperty(window, 'self', {
                        value: originalSelf,
                        writable: true,
                        configurable: true
                    });
                    if (originalPermissionsPolicy) {
                        (document as any).permissionsPolicy = originalPermissionsPolicy;
                    } else {
                        delete (document as any).permissionsPolicy;
                    }
                }
            });

            test('iframe WITHOUT microphone permission: voice mode disabled', async () => {
                // Mock iframe detection: window.self !== window.top
                const originalSelf = window.self;
                Object.defineProperty(window, 'self', {
                    value: { notTop: true },
                    writable: true,
                    configurable: true
                });

                // Mock permissionsPolicy.allowsFeature('microphone') to return false
                const originalPermissionsPolicy = (document as any).permissionsPolicy;
                (document as any).permissionsPolicy = {
                    allowsFeature: (feature: string) => false
                };

                try {
                    directline = new DirectLineExport.DirectLine({ ...services });

                    expect(directline.getIsVoiceModeEnabled()).toBe(false);

                    const textActivity = DirectLineMock.mockActivity('iframe-no-mic');
                    const actual: Array<DirectLineExport.Activity> = [];

                    const scenario = function* (): IterableIterator<Observable<unknown>> {
                        yield Observable.timer(200, scheduler);
                        yield directline.postActivity(textActivity);
                        yield Observable.timer(100, scheduler);
                    };

                    subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());
                    subscriptions.push(directline.activity$.subscribe(a => actual.push(a)));

                    scheduler.flush();

                    // Verify standard /stream URL (not multimodal)
                    expect(DirectLineMock.hasMultimodalUrl(server)).toBe(false);
                    // Verify HTTP routing: activity echoes back
                    expect(actual).toContainEqual(textActivity);
                } finally {
                    Object.defineProperty(window, 'self', {
                        value: originalSelf,
                        writable: true,
                        configurable: true
                    });
                    if (originalPermissionsPolicy) {
                        (document as any).permissionsPolicy = originalPermissionsPolicy;
                    } else {
                        delete (document as any).permissionsPolicy;
                    }
                }
            });
        });

        describe('Voice Configuration & Events', () => {

            test('getVoiceConfiguration returns undefined initially', () => {
                directline = new DirectLineExport.DirectLine({ ...services });

                expect(directline.getVoiceConfiguration()).toBeUndefined();
            });

            test('agent.capabilities event sets voiceConfiguration and fires capabilitieschanged', () => {
                directline = new DirectLineExport.DirectLine({ ...services });

                let eventFired = false;
                directline.addEventListener('capabilitieschanged', () => {
                    eventFired = true;
                });

                subscriptions.push(directline.activity$.subscribe());

                const scenario = function* (): IterableIterator<Observable<unknown>> {
                    yield Observable.timer(200, scheduler);
                };

                subscriptions.push(lazyConcat(scenario()).observeOn(scheduler).subscribe());

                scheduler.flush();

                // Inject agent.capabilities event
                DirectLineMock.injectAgentCapabilities(server);

                // Verify voiceConfiguration is set
                const config = directline.getVoiceConfiguration();
                expect(config).toBeDefined();
                expect(config?.sampleRate).toBe(24000);
                expect(config?.chunkIntervalMs).toBe(100);

                // Verify capabilitieschanged event fired
                expect(eventFired).toBe(true);
            });
        });
    });
});
