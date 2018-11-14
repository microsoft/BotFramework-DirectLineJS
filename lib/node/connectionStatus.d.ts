declare class ConnectionStatus {
    static BotError: ConnectionStatus;
    static Connecting: ConnectionStatus;
    static Ended: ConnectionStatus;
    static ExpiredToken: ConnectionStatus;
    static FailedToConnect: ConnectionStatus;
    static IndeterminateError: ConnectionStatus;
    static Online: ConnectionStatus;
    static Uninitialized: ConnectionStatus;
    /**
     * Details about the error associated with this status.
     */
    error?: {
        status: number;
        statusText: string;
    };
    constructor();
}
export { ConnectionStatus };
