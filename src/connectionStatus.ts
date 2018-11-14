class ConnectionStatus {
  // The bot is unavailable or returned an error
  public static BotError = new ConnectionStatus();
  // currently trying to connect to the conversation
  public static Connecting = new ConnectionStatus();
  // the bot ended the conversation
  public static Ended = new ConnectionStatus();
  // last operation produced an error with an expired token. Possibly waiting for someone to supply a new one.
  public static ExpiredToken = new ConnectionStatus();
  // the initial attempt to connect to the conversation failed. No recovery possible.
  public static FailedToConnect = new ConnectionStatus();
  // a non-specific error occurred
  public static IndeterminateError = new ConnectionStatus();
  // successfully connected to the conversation. Connection is healthy so far as we know.
  public static Online = new ConnectionStatus();
  // the status when the DirectLine object is first created/constructed
  public static Uninitialized = new ConnectionStatus();

  /**
   * Details about the error associated with this status.
   */
  public error?: { status: number, statusText: string };

  constructor() {
    if (Object.isFrozen(ConnectionStatus)) {
      throw new Error('ConnectionStatus cannot be constructed')
    }
  }
}

Object.freeze(ConnectionStatus);
export { ConnectionStatus };