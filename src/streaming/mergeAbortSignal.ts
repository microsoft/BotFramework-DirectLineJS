// TODO: Add tests
export default function mergeAbortSignal(...signals: AbortSignal[]): AbortSignal {
  const abortController = new AbortController();
  let handleAbort: () => void;

  handleAbort = () => {
    abortController.abort();

    for (const signal of signals) {
      signal.removeEventListener('abort', handleAbort);
    }
  };

  for (const signal of signals) {
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  return abortController.signal;
}
