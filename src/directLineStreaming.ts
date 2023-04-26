// In order to keep file size down, only import the parts of rxjs that we use

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Buffer } from 'buffer';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as BFSE from 'botframework-streaming';
import createDeferred from './createDeferred';
import fetch from 'cross-fetch';

import type { Deferred } from './createDeferred';

import {
  Activity,
  ConnectionStatus,
  Conversation,
  IBotConnection,
  Media,
  Message
} from './directLine';

const DIRECT_LINE_VERSION = 'DirectLine/3.0';
const MAX_RETRY_COUNT = 3;
const refreshTokenLifetime = 30 * 60 * 1000;
//const refreshTokenLifetime = 5000;
const timeout = 20 * 1000;
const refreshTokenInterval = refreshTokenLifetime / 2;

interface DirectLineStreamingOptions {
  token: string,
  conversationId?: string,
  domain: string,
  // Attached to all requests to identify requesting agent.
  botAgent?: string
}

class StreamHandler implements BFSE.RequestHandler {
  private connectionStatus$;
  private subscriber: Subscriber<Activity>;
  private shouldQueue: () => boolean;
  private activityQueue: Array<Activity> = [];

  constructor(s: Subscriber<Activity>, c$: Observable<ConnectionStatus>, sq: () => boolean) {
    this.subscriber = s;
    this.connectionStatus$ = c$;
    this.shouldQueue = sq;
  }

  public setSubscriber(s: Subscriber<Activity>) {
    this.subscriber = s;
  }

  async processRequest(request: BFSE.IReceiveRequest, logger?: any): Promise<BFSE.StreamingResponse> {
    const streams = [...request.streams];
    const stream0 = streams.shift();
    const activitySetJson = await stream0.readAsString();
    const activitySet = JSON.parse(activitySetJson);

    if (activitySet.activities.length !== 1) {
      // Only one activity is expected in a set in streaming
      this.subscriber.error(new Error('there should be exactly one activity'));
      return BFSE.StreamingResponse.create(500);
    }

    const activity = activitySet.activities[0];

    if (streams.length > 0) {
      const attachments = [...activity.attachments];

      let stream: BFSE.ContentStream;
      while (stream = streams.shift()) {
        const attachment = await stream.readAsString();
        const dataUri = "data:text/plain;base64," + attachment;
        attachments.push({ contentType: stream.contentType, contentUrl: dataUri });
      }

      activity.attachments = attachments;
    }

    if (this.shouldQueue()) {
      this.activityQueue.push(activity);
    } else {
      this.subscriber.next(activity);
    }

    return BFSE.StreamingResponse.create(200);
  }

  public flush() {
    this.connectionStatus$.subscribe(cs => { })
    this.activityQueue.forEach((a) => this.subscriber.next(a));
    this.activityQueue = [];
  }

  public end() {
    this.subscriber.complete();
  }
}

export class DirectLineStreaming implements IBotConnection {
  public connectionStatus$ = new BehaviorSubject(ConnectionStatus.Uninitialized);
  public activity$: Observable<Activity>;

  private activitySubscriber: Subscriber<Activity>;
  private connectDeferred: Deferred<void>;
  private theStreamHandler: StreamHandler;

  private domain: string;

  private conversationId: string;
  private token: string;
  private streamConnection: BFSE.WebSocketClient;
  private queueActivities: boolean;

  private _botAgent = '';

  constructor(options: DirectLineStreamingOptions) {
    this.token = options.token;

    this.refreshToken().catch(() => {
      this.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    });

    this.domain = options.domain;

    if (options.conversationId) {
      this.conversationId = options.conversationId;
    }

    this._botAgent = this.getBotAgent(options.botAgent);

    this.queueActivities = true;
    this.activity$ = Observable.create(async (subscriber: Subscriber<Activity>) => {
      this.activitySubscriber = subscriber;
      this.theStreamHandler = new StreamHandler(subscriber, this.connectionStatus$, () => this.queueActivities);

      // Resolving connectDeferred will kick-off the connection.
      this.connectDeferred.resolve();
    }).share();

    // connectWithRetryAsync() will create the connectDeferred object required in activity$.
    this.connectWithRetryAsync();
  }

  public reconnect({ conversationId, token } : Conversation) {
    if (this.connectionStatus$.getValue() === ConnectionStatus.Ended) {
      throw new Error('Connection has ended.');
    }

    this.conversationId = conversationId;
    this.token = token;

    this.connectDeferred.resolve();
  }

  end() {
    // Once end() is called, no reconnection can be made.
    this.activitySubscriber.complete();

    this.connectionStatus$.next(ConnectionStatus.Ended);
    this.connectionStatus$.complete();

    this.streamConnection.disconnect();
  }

  private commonHeaders() {
    return {
      "Authorization": `Bearer ${this.token}`,
      "x-ms-bot-agent": this._botAgent
    };
  }

  private getBotAgent(customAgent: string = ''): string {
    let clientAgent = 'directlineStreaming'

    if (customAgent) {
      clientAgent += `; ${customAgent}`
    }

    return `${DIRECT_LINE_VERSION} (${clientAgent})`;
  }

  private async refreshToken(firstCall = true, retryCount = 0) {
    await this.waitUntilOnline();

    let numberOfAttempts = 0;
    while(numberOfAttempts < MAX_RETRY_COUNT) {
      numberOfAttempts++;
      await new Promise(r => setTimeout(r, refreshTokenInterval));
      try {
        const res = await fetch(`${this.domain}/tokens/refresh`, {method: "POST", headers: this.commonHeaders()});
        if (res.ok) {
          numberOfAttempts = 0;
          const {token} = await res.json();
          this.token = token;
        } else {
          if (res.status === 403 || res.status === 403) {
            console.error(`Fatal error while refreshing the token: ${res.status} ${res.statusText}`);
            this.streamConnection.disconnect();
          } else {
            console.warn(`Refresh attempt #${numberOfAttempts} failed: ${res.status} ${res.statusText}`);
          }
        }
      } catch(e) {
        console.warn(`Refresh attempt #${numberOfAttempts} threw an exception: ${e}`);
      }
    }

    console.error("Retries exhausted");
    this.streamConnection.disconnect();
  }

  postActivity(activity: Activity) {
    if (this.connectionStatus$.value === ConnectionStatus.Ended || this.connectionStatus$.value === ConnectionStatus.FailedToConnect) {
      return Observable.throw(new Error('Connection is closed'));
    }

    if (activity.type === "message" && activity.attachments && activity.attachments.length > 0) {
      return this.postMessageWithAttachments(activity);
    }

    const resp$ = Observable.create(async subscriber => {
      const request = BFSE.StreamingRequest.create('POST', '/v3/directline/conversations/' + this.conversationId + '/activities');
      request.setBody(JSON.stringify(activity));

      try {
        const resp = await this.streamConnection.send(request);
        if (resp.statusCode !== 200) throw new Error("PostActivity returned " + resp.statusCode);
        const numberOfStreams = resp.streams.length;
        if (numberOfStreams !== 1) throw new Error("Expected one stream but got " + numberOfStreams)
        const idString = await resp.streams[0].readAsString();
        const {Id : id} = JSON.parse(idString);
        subscriber.next(id);
        return subscriber.complete();
      } catch(e) {
          // If there is a network issue then its handled by
          // the disconnectionHandler. Everything else can
          // be retried
          console.warn(e);
          this.streamConnection.disconnect();
          return subscriber.error(e);
      }
    });
    return resp$;
  }

  private postMessageWithAttachments(message: Message) {
    const { attachments, ...messageWithoutAttachments } = message;

    return Observable.create( subscriber => {
      const httpContentList = [];
      (async () => {
        try {
          const arrayBuffers = await Promise.all(attachments.map(async attachment => {
            const media = attachment as Media;
            const res = await fetch(media.contentUrl);
            if (res.ok) {
              return { arrayBuffer: await res.arrayBuffer(), media };
            } else {
              throw new Error('...');
            }
          }));

          arrayBuffers.forEach(({ arrayBuffer, media }) => {
            const buffer = Buffer.from(arrayBuffer);
            const stream = new BFSE.SubscribableStream();
            stream.write(buffer);
            const httpContent = new BFSE.HttpContent({ type: media.contentType, contentLength: buffer.length }, stream);
            httpContentList.push(httpContent);
          });

          const url = `/v3/directline/conversations/${this.conversationId}/users/${messageWithoutAttachments.from.id}/upload`;
          const request = BFSE.StreamingRequest.create('PUT', url);
          const activityStream = new BFSE.SubscribableStream();
          activityStream.write(JSON.stringify(messageWithoutAttachments), 'utf-8');
          request.addStream(new BFSE.HttpContent({ type: "application/vnd.microsoft.activity", contentLength: activityStream.length }, activityStream));
          httpContentList.forEach(e => request.addStream(e));

          const resp = await this.streamConnection.send(request);
          if (resp.streams && resp.streams.length !== 1) {
            subscriber.error(new Error(`Invalid stream count ${resp.streams.length}`));
          } else {
            const {Id: id} = await resp.streams[0].readAsJson<{Id: string}>();
            subscriber.next(id);
            subscriber.complete();
          }
        } catch(e) {
          subscriber.error(e);
        }
      })();
    });
  }

  private async waitUntilOnline() {
    return new Promise<void>((resolve, reject) => {
      this.connectionStatus$.subscribe((cs) => {
        if (cs === ConnectionStatus.Online) return resolve();
      },
        (e) => reject(e));
    })
  }

  private async connectAsync(connectedCallback?: () => void) {
    const re = new RegExp('^http(s?)');
    if (!re.test(this.domain)) throw ("Domain must begin with http or https");
    const params = {token: this.token};
    if (this.conversationId) params['conversationId'] = this.conversationId;
    const urlSearchParams = new URLSearchParams(params).toString();
    const wsUrl = `${this.domain.replace(re, 'ws$1')}/conversations/connect?${urlSearchParams}`;

    // This promise will resolve when it is disconnected.
    return new Promise(async (resolve, reject) => {
      try {
        this.streamConnection = new BFSE.WebSocketClient({
          url: wsUrl,
          requestHandler: this.theStreamHandler,
          disconnectionHandler: (e) => resolve(e)
        });

        this.queueActivities = true;
        await this.streamConnection.connect();
        const request = BFSE.StreamingRequest.create('POST', '/v3/directline/conversations');
        const response = await this.streamConnection.send(request);
        if (response.statusCode !== 200) throw new Error("Connection response code " + response.statusCode);
        if (response.streams.length !== 1) throw new Error("Expected 1 stream but got " + response.streams.length);
        const responseString = await response.streams[0].readAsString();
        const conversation = JSON.parse(responseString);
        this.conversationId = conversation.conversationId;
        this.connectionStatus$.next(ConnectionStatus.Online);

        // Wait until DL consumers have had a chance to be notified
        // of the connection status change.
        await this.waitUntilOnline();
        this.theStreamHandler.flush();
        this.queueActivities = false;
        connectedCallback?.();
      } catch(e) {
        reject(e);
      }
    });
  }

  private async connectWithRetryAsync() {
    // This for-loop will break when someone call end() and it will signal ConnectionStatus.Ended.
    for (;;) {
      // Create a new signal and wait for someone kicking off the connection:
      // - subscribe to activity$, or;
      // - retries exhausted (FailedToConnect), then, someone call reconnect()
      await (this.connectDeferred = createDeferred()).promise;

      let connected = false;
      let numRetries = MAX_RETRY_COUNT;

      this.connectionStatus$.next(ConnectionStatus.Connecting);

      while (numRetries > 0) {
        numRetries--;

        const start = Date.now();

        try {
          // This promise will reject/resolve when disconnected.
          await this.connectAsync(() => {
            connected = true;
          });
        } catch (err) {}

        // If someone call end() to break the connection, we will never listen to any reconnect().
        if (this.connectionStatus$.getValue() === ConnectionStatus.Ended) {
          return;
        }

        // Make sure we don't signal ConnectionStatus.Connecting twice or more without an actual connection.
        // Subsequent retries should be transparent.
        if (connected) {
          this.connectionStatus$.next(ConnectionStatus.Connecting);

          connected = false;
        }

        // If the current connection lasted for more than a minute, the previous connection is good, which means:
        // - we should reset the retry counter, and;
        // - we should reconnect immediately.
        if (60000 < Date.now() - start) {
          numRetries = MAX_RETRY_COUNT;
        } else if (numRetries > 0) {
          // Sleep only if we are doing retry. Otherwise, we are going to break the loop and signal FailedToConnect.
          await new Promise(r => setTimeout(r, this.getRetryDelay()));
        }
      }

      // TODO: [TEST] Make sure FailedToConnect is reported immediately after last disconnection, should be no getRetryDelay().
      // Failed to reconnect after multiple retries.
      this.connectionStatus$.next(ConnectionStatus.FailedToConnect);
    }
  }

  // Returns the delay duration in milliseconds
  private getRetryDelay() {
    return Math.floor(3000 + Math.random() * 12000);
  }
}
