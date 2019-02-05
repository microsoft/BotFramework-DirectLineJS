declare module 'get-port' {
  const getPort: (options?: { port?: number | ReadonlyArray<number>, host?: string }) => PromiseLike<number>;

  export default getPort;
}
