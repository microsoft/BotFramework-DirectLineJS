import { Activity } from 'botframework-schema';
import { ConnectionStatus } from './connectionStatus';
import { Conversation, DirectLineOptions } from './directLineTypes';
/**
 * The DirectLine class is an implementation of the
 * DirectLine APIs provided as part of the Azure Bot Services
 * that allows your client application to communicate with
 * your bot. This implementation provides some common usages
 * of the API including creating or reconnecting to a conversation,
 * token retrieval and refreshing, and sending/retrieving activities.
 */
export declare class DirectLine {
    referenceGrammarId: string;
    private readonly domain;
    private status;
    private conversationId;
    private isomorphicWS;
    private pendingResolvers;
    private pollingInterval;
    private resolver;
    private secret;
    private socketConnection;
    private streamUrl;
    private token;
    private useWebSocket;
    private watermark;
    private tokenRefreshTimer;
    constructor(options: DirectLineOptions);
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
    [Symbol.iterator](): IterableIterator<Promise<ConnectionStatus | Activity[]>>;
    /**
     * Posts an activity to the conversation. If a conversation does not
     * exist, a new on is created. If a conversation exists but the
     * connection has been lost, ana attempt to reconnect is made.
     *
     * @param {Activity} activity The Activity object to post to the conversation
     */
    postActivity(activity: Activity): Promise<string>;
    /**
     * Reconnects to the specified conversation
     * and opens a socket to receive activities if
     * the usage of a socket was specified in the
     * DirectLineOptions
     *
     * @param {Conversation} conversation The conversation to reconnect to
     */
    reconnect(conversation: Conversation): Promise<ConnectionStatus>;
    /**
     * Ends the current conversation and closes
     * the socket connection if one exists.
     */
    end(): void;
    /**
     * Gets the session ID of the current conversation.
     * If a conversation has not yet been started, an
     * attempt is made to start one before the session ID
     * is returned. If an existing conversation was started
     * but the connection has been lost, an attempt to
     * reconnect is made.
     */
    getSesstionId(): Promise<string>;
    /**
     * Polls DirectLine for activities based on the pollingInterval
     * specified in the DirectLineOptions. The promise is resolved
     * only after new activities are received.
     */
    protected poll(): Promise<Activity[] | ConnectionStatus>;
    /**
     * Opens a socket connection to the streamUrl.
     * This function is called when a conversation is
     * created and the DirectLineOptions indicate the
     * usage of a socket.
     */
    protected openSocketConnection(): Promise<ConnectionStatus>;
    /**
     * Checks the connection to DirectLine and stats a new
     * conversation if one does not already exist or connects
     * to an existing conversation a conversationId is available.
     */
    protected checkConnection(): Promise<ConnectionStatus>;
    /**
     * Starts a new conversation or gets an existing
     * conversation if an conversationId exists.
     */
    protected startConversation(): Promise<Response>;
    /**
     * Initiates a perpetual heartbeat tht refreshes the
     * token at the specified expiry interval minus 60 seconds.
     * This heartbeat dies when the connection status changes
     * to anything other than ConnectionStatus.Online.
     *
     * @param {number} expiry The number of seconds before the
     * token expires
     */
    protected refreshTokenHeartbeat(expiry: number): void;
    /**
     * Reconnects to the current conversation stream. This
     * function is used to re-establish a socket connection if
     * it was disconnected abruptly.
     */
    protected reconnectToConversation(): Promise<ConnectionStatus>;
    /**
     * Maps an unsuccessful response to one of the enumerated
     * Connection status objects and returns that object.
     *
     * @param {Response} response The Response object from an unsuccessful fetch operation.
     */
    protected processError(response: Response): ConnectionStatus;
    /**
     * Posts message activities with attachments using the
     * multipart/form-data protocol.
     *
     * @param {Attachment[]} attachments The array of Attachment to post
     * @param {Activity} messageWithoutAttachments The Activity with the attachments stripped.
     */
    private postMessageWithAttachments;
    private readonly headers;
}
