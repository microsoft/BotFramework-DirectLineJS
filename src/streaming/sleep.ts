type Init = {
  signal?: AbortSignal;
};

export default async function sleep(durationInMS: number = 100, init: Init = {}): Promise<void> {
  // Rectifying `durationInMS`.
  durationInMS = Math.max(0, durationInMS);

  const { signal } = init;

  if (signal?.aborted) {
    return Promise.reject(new Error('Aborted.'));
  }

  let handleAbort: () => void;
  let timeout: ReturnType<typeof setTimeout>;

  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => reject(new Error('Aborted.'));

    timeout = setTimeout(resolve, durationInMS);
    signal?.addEventListener('abort', handleAbort, { once: true });
  }).finally(() => {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', handleAbort);
  });
}
