// In order to keep file size down, only import the parts of rxjs that we use

import { AjaxResponse, AjaxRequest } from 'rxjs/observable/dom/AjaxObservable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subscription } from 'rxjs/Subscription';
import * as BFSE from 'botframework-streaming-extensions';

import { _throw } from 'rxjs/observable/throw'

import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/combineLatest';
import 'rxjs/add/operator/count';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/retryWhen';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/take';

import 'rxjs/add/observable/dom/ajax';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/from';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/throw';

import dedupeFilenames from './dedupeFilenames';

import { Media, Activity, Message, IBotConnection, Conversation, ConnectionStatus, DirectLineOptions } from './directLine';

const DIRECT_LINE_VERSION = 'DirectLine/3.0';
const MAX_RETRY_COUNT = 3;
const refreshTokenLifetime = 30 * 60 * 1000;
const timeout = 20 * 1000;
const refreshTokenInterval = refreshTokenLifetime / 2;
const retries = (refreshTokenLifetime - refreshTokenInterval) / timeout;

class StreamHandler implements BFSE.RequestHandler {
  private connectionStatus$;
  private subscriber: Subscriber<Activity>;
  private activityQueue: Array<Activity> = [];

  constructor(s: Subscriber<Activity>, c$: Observable<ConnectionStatus>) {
    this.subscriber = s;
    this.connectionStatus$ = c$;
  }

  public setSubscriber(s: Subscriber<Activity>) {
    this.subscriber = s;
  }

  async processRequest(request: BFSE.IReceiveRequest, logger?: any): Promise<BFSE.StreamingResponse> {
    let stream0 = request.streams.shift();
    let activitySetJson = await stream0.readAsString();
    let activitySet = JSON.parse(activitySetJson);

    if (activitySet.activities.length != 1) {
      // Only one activity is expected in a set in streaming
      this.subscriber.error(activitySet)
      let r = new BFSE.StreamingResponse();
      r.statusCode = 500;
      return r;
    }

    var attachments = activitySet.activities[0].attachments;
    let stream: BFSE.ContentStream;
    while (stream = request.streams.shift()) {
      let atch = await stream.readAsString();
      var dataUri = "data:text/plain;base64," + atch;
      attachments.push({ contentType: stream.contentType, contentUrl: dataUri });
    }

    activitySet.activities[0].attachments = attachments;


    let activity = activitySet.activities[0];
    if (this.connectionStatus$.value == ConnectionStatus.Online) {
      this.subscriber.next(activity);
    } else {
      this.activityQueue.push(activity);
    }

    let r = new BFSE.StreamingResponse();
    r.statusCode = 200;
    return r;
  }

  public flush() {
    this.connectionStatus$.subscribe(cs => { })
    this.activityQueue.forEach((a) => this.subscriber.next(a));
    this.activityQueue = [];
  }
}

export class DirectLineStreaming implements IBotConnection {
  public connectionStatus$ = new BehaviorSubject(ConnectionStatus.Uninitialized);
  public activity$: Observable<Activity>;

  private activitySubscriber: Subscriber<Activity>;
  private theStreamHandler: StreamHandler;

  private retryCount = MAX_RETRY_COUNT;

  private domain = "https://directline.botframework.com/v3/directline";

  private conversationId: string;
  private token: string;
  public referenceGrammarId: string;
  private streamConnection: BFSE.WebSocketClient;

  private tokenRefreshSubscription: Subscription;

  private ending: boolean;
  private _botAgent = '';

  constructor(options: DirectLineOptions) {
    this.token = options.secret || options.token;

    if (options.token) {
      this.refreshToken();
    }

    if (options.domain) {
      this.domain = options.domain;
    }

    if (options.conversationId) {
      this.conversationId = options.conversationId;
    }

    this._botAgent = this.getBotAgent(options.botAgent);

    this.activity$ = this.streamingWebSocketActivity$().share();
  }

  public reconnect(conversation: Conversation) {
    this.conversationId = conversation.conversationId;
    this.token = conversation.token;
    this.connectAsync().then(_ => _);
  }

  end() {
    if (this.tokenRefreshSubscription)
      this.tokenRefreshSubscription.unsubscribe();
    this.ending = true;
    this.connectionStatus$.next(ConnectionStatus.Ended);
  }

  getSessionId(): Observable<string> {
    return Observable.create((s) => {
      s.next(100);
    });
  }

  private commonHeaders() {
    return {
      "Authorization": `Bearer ${this.token}`,
      "x-ms-bot-agent": this._botAgent
    };
  }

  private getBotAgent(customAgent: string = ''): string {
    let clientAgent = 'directlinejs'

    if (customAgent) {
      clientAgent += `; ${customAgent}`
    }

    return `${DIRECT_LINE_VERSION} (${clientAgent})`;
  }

  private async refreshToken(firstCall = true) {
    if (firstCall) {
      setTimeout(async () => await this.refreshToken(false), 1000);
      return;
    }

    await this.waitUntilOnline();

    Observable.ajax({
      method: "POST",
      url: `${this.domain}/tokens/refresh`,
      timeout,
      headers: {
        ...this.commonHeaders()
      }
    })
      .subscribe(
        (ajaxResponse) => {
          this.token = ajaxResponse.response.token as string;
          setTimeout(() => this.refreshToken(false), 1000);
        },
        (e) => {
          console.log("GOT ERROR " + e.status);
        })
  }

  postActivity(activity: Activity) {
    if (activity.type === "message" && activity.attachments && activity.attachments.length > 0)
      return this.postMessageWithAttachments(activity);

    let resp$ = Observable.create(subscriber => {
      let request = BFSE.StreamingRequest.create('POST', '/v3/directline/conversations/' + this.conversationId + '/activities');
      request.setBody(JSON.stringify(activity));
      this.streamConnection.send(request)
        .then((resp) => {
          if (resp.statusCode != 200) throw new Error("PostActivity returned " + resp.statusCode);
          let numberOfStreams = resp.streams.length;
          if (numberOfStreams != 1) throw new Error("Expected one stream but got " + numberOfStreams)
          resp.streams[0].readAsString().then((idString) => {
            let idObj = JSON.parse(idString);
            return subscriber.next(idObj.Id)
          });
        })
        .catch((e) => {
          // If there is a network issue then its handled by
          // the disconnectionHandler. Everything else can
          // be retried
          console.warn(e);
          return subscriber.error(e);
        });
    });
    return resp$;
  }

  private postMessageWithAttachments(message: Message) {
    const { attachments, ...messageWithoutAttachments } = message;

    let httpContentList = [];
    return Observable.create(subscriber => {
      return Observable.from(attachments || [])
        .flatMap((media: Media) =>
          Observable.ajax({
            method: "GET",
            url: media.contentUrl,
            responseType: 'arraybuffer'
          })
            .do(ajaxResponse => {
              let buffer = new Buffer(ajaxResponse.response);
              let stream = new BFSE.SubscribableStream();
              stream.write(buffer);
              let httpContent = new BFSE.HttpContent({ type: media.contentType, contentLength: buffer.length }, stream);
              httpContentList.push(httpContent);
            }))
        .count()
        .flatMap(_ => {
          let url = `/v3/directline/conversations/${this.conversationId}/users/${messageWithoutAttachments.from.id}/upload`;
          let request = BFSE.StreamingRequest.create('PUT', url);
          var activityStream = new BFSE.SubscribableStream();
          activityStream.write(JSON.stringify(messageWithoutAttachments), 'utf-8');
          request.addStream(new BFSE.HttpContent({ type: "application/vnd.microsoft.activity", contentLength: activityStream.length }, activityStream));
          httpContentList.forEach(e => request.addStream(e));
          return this.streamConnection.send(request);
        })
        .do(resp => {
          if (resp.streams && resp.streams.length != 1) {
            subscriber.error("Invalid stream count " + resp.streams.length);
          } else {
            resp.streams[0].readAsJson()
              .then(json => {
                subscriber.next(json['Id'])
              })
          }
        })
        .subscribe(_ => _) // force execution
    })
  }


  private errorHandler(e: any) {
    if (this.connectionStatus$.value == ConnectionStatus.Connecting) {
      return;
    }

    this.connectionStatus$.next(ConnectionStatus.Connecting);
    this.retryCount--;
    if (this.retryCount > 0) {
      setTimeout(this.streamingWebSocketActivity$.bind(this), this.getRetryDelay());
    } else {
      console.warn("Exhausted retries");
      this.activitySubscriber.error(e);
    }
  }

  private streamingWebSocketActivity$(): Observable<Activity> {
    if (this.activitySubscriber) {
      this.theStreamHandler.setSubscriber(this.activitySubscriber);
      this.connectAsync().then(_ => _);
    } else {
      return Observable.create(async (subscriber: Subscriber<Activity>) => {
        this.activitySubscriber = subscriber;
        this.theStreamHandler = new StreamHandler(subscriber, this.connectionStatus$);
        await this.connectAsync();
      });
    }
  }

  private async waitUntilOnline() {
    return new Promise<void>((resolve, reject) => {
      this.connectionStatus$.subscribe((cs) => {
        if (cs == ConnectionStatus.Online) return resolve();
      },
        (e) => reject(e));
    })
  }

  private async connectAsync() {
    let re = new RegExp('^http(s?)');
    if (!re.test(this.domain)) throw ("Domain must begin with http or https");
    let wsUrl = this.domain.replace(re, "ws$1") + '/conversations/connect?token=' + this.token + '&conversationId=' + this.conversationId;

    try {
      this.streamConnection = new BFSE.WebSocketClient({
        url: wsUrl,
        requestHandler: this.theStreamHandler,
        disconnectionHandler: this.errorHandler.bind(this)
      });

      await this.streamConnection.connect();
      let request = BFSE.StreamingRequest.create('POST', '/v3/directline/conversations');
      let response = await this.streamConnection.send(request);
      if (response.statusCode !== 200) throw new Error("Connection response code " + response.statusCode);
      if (response.streams.length !== 1) throw new Error("Expected 1 stream but got " + response.streams.length);
      let responseString = await response.streams[0].readAsString();
      let conversation = JSON.parse(responseString);
      this.conversationId = conversation.conversationId;
      this.referenceGrammarId = conversation.referenceGrammarId;
      this.connectionStatus$.next(ConnectionStatus.Online);

      // Wait until DL consumers have had a chance to be notified
      // of the connection status change.
      await this.waitUntilOnline();
      this.theStreamHandler.flush();
      this.retryCount = MAX_RETRY_COUNT;
    } catch (e) {
      console.warn(e);
      this.streamConnection.disconnect();
    }
  }

  // Returns the delay duration in milliseconds
  private getRetryDelay() {
    return Math.floor(3000 + Math.random() * 12000);
  }
}