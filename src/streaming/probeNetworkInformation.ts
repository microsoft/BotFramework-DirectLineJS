/// <reference path="./NetworkInformation.d.ts" />

type ProbeNetworkInformationInit = {
  signal: AbortSignal;
};

/**
 * Probes the connection a device is using to communicate with the network via [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API).
 *
 * When the connection change, the probe will treat it as a fault.
 */
export default function probeNetworkInformation(
  connection: NetworkInformation,
  { signal }: ProbeNetworkInformationInit
): AbortSignal {
  const abortController = new AbortController();
  const handleNetworkInformationChange = () => abortController.abort();

  connection.addEventListener('change', handleNetworkInformationChange, { once: true });

  signal?.addEventListener('abort', () => {
    connection.removeEventListener('change', handleNetworkInformationChange);
    abortController.abort();
  });

  return abortController.signal;
}
