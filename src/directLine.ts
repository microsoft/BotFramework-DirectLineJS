import { Activity, ActivityTypes } from 'botframework-schema';
import { ConnectionStatus } from './connectionStatus';
import { ActivityGroup, Conversation, DirectLineOptions } from './directLineTypes';

/**
 * Node compatibility - This strategy hides
 * node-only dependencies from being bundled
 * in a browser based project even for dev builds.
 */
declare var __NODE__: boolean;
if (__NODE__) {
  (new Function(`
  if (!('FormData' in global)) {
    global.FormData = require('form-data');
  }

  if (!('fetch' in global)) {
    global.fetch = require('node-fetch');
  }`))();
}

/**
 * The DirectLine class is an implementation of the
 * DirectLine APIs provided as part of the Azure Bot Services
 * that allows your client application to communicate with
 * your bot. This implementation provides some common usages
 * of the API including creating or reconnecting to a conversation,
 * token retrieval and refreshing, and sending/retrieving activities.
 */
export class DirectLine {
  public referenceGrammarId: string;
  private readonly domain: string;

  private status = ConnectionStatus.Uninitialized;
  private conversationId: string;
  private isomorphicWS: { new(url: string, protocols?: string | string[]): WebSocket; };
  private pendingResolvers: WeakMap<(value?: any) => void, Promise<any>> = new WeakMap();
  private pollingInterval: number;
  private resolver: (value?: any) => void;
  private secret: string;
  private socketConnection: WebSocket;
  private streamUrl: string;
  private token: string;
  private useWebSocket: boolean;
  private watermark = '';
  private tokenRefreshTimer: any;

  constructor(options: DirectLineOptions) {
    const {
      conversationId,
      domain = 'https://directline.botframework.com/v3/directline',
      isomorphicWS,
      pollingInterval = 1000,
      secret,
      streamUrl,
      token,
      watermark,
      useWebSocket,
    } = options;

    Object.assign(this, {
      conversationId,
      domain,
      isomorphicWS,
      pollingInterval,
      secret,
      streamUrl,
      token,
      watermark,
      useWebSocket,
    });
  }

  /**
   * The generator that delivers Promises that resolve to
   * either a ConnectionStatus object or an array of Activity
   * objects. The iterator will continue to deliver Promises until
   * end() is called.
   *
   * Consumers of the iterator must wait until the Promise is
   * resolved before advancing the cursor.
   *
   * @example
   * const directLine = new DirectLine(directLineOptions);
   * async function directLineConsumer(directLine: DirectLine): void {
   *   for (let promise: Promise<ConnectionStatus | Activity[]> of directLine) {
   *     const result = await promise; // Resolved with a ConnectionStatus or an Array of Activity objects
   *     if (result instanceof ConnectionStatus) {
   *       // do connection status related things
   *     } else if (result instanceof Array) {
   *       // do activity related things
   *     }
   *     if (<some condition>) {
   *        // Stop the loop manually
   *       directLine.end();
   *       break;
   *     }
   *   }
   *   return true;
   * }
   *
   * directLineConsumer(directLine).then(done => console.log('Conversation ended'));
   */
  public* [Symbol.iterator](): IterableIterator<Promise<ConnectionStatus | Activity[]>> {
    while (this.status !== ConnectionStatus.Ended) {
      // If we have a promise in queue, return it
      let pendingPromise = this.pendingResolvers.get(this.resolver);
      if (pendingPromise) {
        yield pendingPromise;
      }
      // Otherwise, create a new one
      pendingPromise = new Promise<ConnectionStatus | Activity[]>(async (resolve) => {
        this.resolver = resolve;
        this.pendingResolvers.set(resolve, pendingPromise);
        // Attempt the initial connection - this status transition happens just once.
        if (this.status === ConnectionStatus.Uninitialized) {
          resolve(this.status = ConnectionStatus.Connecting);
        } else {
          const connection = await this.checkConnection();
          if (connection) {
            resolve(connection);
          } else if (!this.useWebSocket) {
            const pollResponse: ConnectionStatus | Activity[] = await this.poll();
            resolve(pollResponse);
          }
        }
      });

      yield pendingPromise;
    }
  }

  /**
   * Posts an activity to the conversation. If a conversation does not
   * exist, a new on is created. If a conversation exists but the
   * connection has been lost, ana attempt to reconnect is made.
   *
   * @param {Activity} activity The Activity object to post to the conversation
   */
  public async postActivity(activity: Activity): Promise<string> {
    const connectionStatus = await this.checkConnection();
    if (connectionStatus === ConnectionStatus.FailedToConnect) {
      const { status, statusText } = ConnectionStatus.FailedToConnect.error;
      throw new Error(`${status}: ${statusText}`);
    }

    if (activity.type === ActivityTypes.Message && (activity.attachments || []).length) {
      return this.postMessageWithAttachments(activity);
    }

    const { conversationId, domain, headers } = this;
    headers['Content-type'] = 'application/json';
    const url = `${domain}/conversations/${conversationId}/activities`;
    const response = await fetch(url, { method: 'POST', body: JSON.stringify(activity), headers });

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    const { id } = await response.json();
    return id;
  }

  /**
   * Reconnects to the specified conversation
   * and opens a socket to receive activities if
   * the usage of a socket was specified in the
   * DirectLineOptions
   *
   * @param {Conversation} conversation The conversation to reconnect to
   */
  public async reconnect(conversation: Conversation): Promise<ConnectionStatus> {
    const { token, streamUrl } = conversation;
    Object.assign(this, { token, streamUrl });
    return this.checkConnection();
  }

  /**
   * Ends the current conversation and closes
   * the socket connection if one exists.
   */
  public end() {
    if (this.socketConnection) {
      this.socketConnection.close(1000);
    }
    this.resolver((this.status = ConnectionStatus.Ended));
    // Normalize and prepare for a new conversation
    this.status = ConnectionStatus.Uninitialized;
  }

  /**
   * Gets the session ID of the current conversation.
   * If a conversation has not yet been started, an
   * attempt is made to start one before the session ID
   * is returned. If an existing conversation was started
   * but the connection has been lost, an attempt to
   * reconnect is made.
   */
  public async getSesstionId(): Promise<string> {
    const connectionStatus = await this.checkConnection();
    if (connectionStatus === ConnectionStatus.FailedToConnect) {
      throw new Error('Error: could not connect to the conversation');
    }
    const { domain, headers } = this;
    const url = `${domain}/session/getsessionid`;
    const response = await fetch(url, { headers, credentials: 'include' });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    const { sessionId } = await response.json();
    return sessionId;
  }

  /**
   * Polls DirectLine for activities based on the pollingInterval
   * specified in the DirectLineOptions. The promise is resolved
   * only after new activities are received.
   */
  protected async poll(): Promise<Activity[] | ConnectionStatus> {
    // Poll until we receive an error or a
    // non-zero length array of activities.
    while (this.status === ConnectionStatus.Online) {
      await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      const { conversationId, domain, headers, watermark } = this;
      const url = `${ domain }/conversations/${ conversationId }/activities?watermark=${ watermark }`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return this.processError(response);
      }
      const { activities, watermark: advancedWatermark } = await response.json() as ActivityGroup;
      this.watermark = advancedWatermark;

      if ((activities || []).length) {
        return activities;
      }
    }
    return null;
  }

  /**
   * Opens a socket connection to the streamUrl.
   * This function is called when a conversation is
   * created and the DirectLineOptions indicate the
   * usage of a socket.
   */
  protected openSocketConnection(): Promise<ConnectionStatus> {
    if (this.socketConnection) {
      this.socketConnection.close(1000);
    }
    this.socketConnection = new this.isomorphicWS(this.streamUrl);

    this.socketConnection.onmessage = (event: MessageEvent) => {
      this.resolver(JSON.parse(event.data));
    };

    this.socketConnection.onclose = () => {
      this.resolver(this.status = ConnectionStatus.Ended);
    };

    this.socketConnection.onerror = this.reconnectToConversation;

    return new Promise(resolve => this.socketConnection.onopen = () => resolve(ConnectionStatus.Online));
  }

  /**
   * Checks the connection to DirectLine and stats a new
   * conversation if one does not already exist or connects
   * to an existing conversation a conversationId is available.
   */
  protected async checkConnection(): Promise<ConnectionStatus> {
    if (this.status === ConnectionStatus.Online) {
      return null;
    }
    // If we're not online, attempt to connect
    const response = await this.startConversation();
    const { status, statusText } = response;
    if (!response.ok) {
      ConnectionStatus.FailedToConnect.error = { status, statusText };
      return (this.status = ConnectionStatus.FailedToConnect);
    }
    const { conversationId, eTag, streamUrl, referenceGrammarId, token, expires_in } = await response.json() as Conversation;
    Object.assign(this, { conversationId, token, streamUrl, eTag, referenceGrammarId });
    if (!this.secret) {
      this.refreshTokenHeartbeat(expires_in);
    }
    // We're socket enabled - connect with the streamUrl in the response
    // and hand off the connection status update to the socket.
    if (streamUrl && this.useWebSocket) {
      return (this.status = await this.openSocketConnection());
    }
    // We're polling so assume an online status.
    return (this.status = ConnectionStatus.Online);
  }

  /**
   * Starts a new conversation or gets an existing
   * conversation if an conversationId exists.
   */
  protected async startConversation(): Promise<Response> {
    const { conversationId, domain, headers, watermark } = this;
    let url = `${domain}/conversations`;
    if (conversationId) {
      url += `/${conversationId}?watermark=${watermark}`;
    }
    const method = conversationId ? 'GET' : 'POST';
    return fetch(url, { method, headers });
  }

  /**
   * Initiates a perpetual heartbeat tht refreshes the
   * token at the specified expiry interval minus 60 seconds.
   * This heartbeat dies when the connection status changes
   * to anything other than ConnectionStatus.Online.
   *
   * @param {number} expiry The number of seconds before the
   * token expires
   */
  protected refreshTokenHeartbeat(expiry: number): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    const doTokenRefresh = async () => {
      // Late check for the connection status in case
      // it has changed since the timeout was initiated.
      if (this.status === ConnectionStatus.Online) {
        return null;
      }
      const url = `${this.domain}/tokens/refresh`;
      const response = await fetch(url, { method: 'POST', headers: this.headers });
      if (!response.ok) {
        return this.processError(response);
      }
      const { token, expires_in } = await response.json() as Conversation;
      this.token = token;
      return this.refreshTokenHeartbeat(expires_in);
    };
    // refresh 60 seconds before expiration.
    this.tokenRefreshTimer = setTimeout(doTokenRefresh, expiry - 60 * 60 * 1000);
  }

  /**
   * Reconnects to the current conversation stream. This
   * function is used to re-establish a socket connection if
   * it was disconnected abruptly.
   */
  protected async reconnectToConversation(): Promise<ConnectionStatus> {
    const { conversationId, domain, watermark, headers } = this;
    const url = `${domain}/conversations/${conversationId}?watermark=${watermark}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return this.processError(response);
    }
    const { token, streamUrl } = await response.json();
    Object.assign(this, { token, streamUrl });
    return (this.status = await this.openSocketConnection());
  }

  /**
   * Maps an unsuccessful response to one of the enumerated
   * Connection status objects and returns that object.
   *
   * @param {Response} response The Response object from an unsuccessful fetch operation.
   */
  protected processError(response: Response): ConnectionStatus {
    const { status, statusText } = response;
    let connectionStatus: ConnectionStatus;
    switch (status) {

      case 403:
        connectionStatus = ConnectionStatus.ExpiredToken;
        break;

      case 404:
        connectionStatus = ConnectionStatus.Ended;
        break;

      case 502:
        connectionStatus = ConnectionStatus.BotError;
        break;

      default:
        connectionStatus = ConnectionStatus.IndeterminateError;
        break;
    }
    if (connectionStatus) {
      connectionStatus.error = { status, statusText };
    }
    return (this.status = connectionStatus);
  }

  /**
   * Posts message activities with attachments using the
   * multipart/form-data protocol.
   *
   * @param {Attachment[]} attachments The array of Attachment to post
   * @param {Activity} messageWithoutAttachments The Activity with the attachments stripped.
   */
  private async postMessageWithAttachments({ attachments, ... messageWithoutAttachments }: Activity): Promise<string> {
    const body = new FormData();
    body.append('activity', JSON.stringify(messageWithoutAttachments));

    const attachmentResponses: Response[] = await Promise.all(attachments.map(attachment => fetch(attachment.contentUrl)));
    attachmentResponses.forEach(async (response, index) => {
      const blob = await response.blob();
      const { name, contentUrl } = attachments[index];
      const fileName = getFileNameFromPath(contentUrl);
      body.append(name, blob, fileName);
    });

    const { domain, conversationId, headers } = this;
    const url = `${domain}/conversations/${conversationId}/upload?userId=${messageWithoutAttachments.from.id}`;
    const response = await fetch(url, { method: 'POST', headers, body });
    if (response.status !== 200) {
      return null;
    }
    const { id } = await response.json();
    return id;
  }

  private get headers(): HeadersInit {
    return {
      'Accept': 'application/json',
      'Authorization': `Bearer ${(this.secret || this.token)}`,
    }
  }
}

/**
 * Retrieves the file name from the specified path
 *
 * @param {string} path The path to retrieve the file name from
 */
function getFileNameFromPath(path: string): string {
  const index = path.lastIndexOf('/');
  const targetIndex = index === -1 ? 0 : index;
  return path.substr(targetIndex);
}