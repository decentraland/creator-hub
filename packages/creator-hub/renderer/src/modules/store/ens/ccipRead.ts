import { createPublicClient, http, isHex, type Address, type Hex, type PublicClient } from 'viem';

export const ENS_RECORD_TIMEOUT_MS = 15_000;
/** Address and contenthash answers are a few hundred bytes; the cap stops a gateway streaming junk. */
export const ENS_GATEWAY_MAX_RESPONSE_BYTES = 64 * 1024;

type GatewayRequest = { data: Hex; sender: Address; urls: readonly string[] };

/** Only HTTPS DNS hosts are accepted. Redirects cannot bypass this URL policy.
 * This is not DNS-based network isolation: a public hostname can still resolve to a private IP.
 */
function gatewayUrl(template: string, sender: Address, data: Hex): URL {
  const url = new URL(template.replace('{sender}', sender.toLowerCase()).replace('{data}', data));
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !host.includes('.') ||
    host.includes(':') ||
    /^[\d.]+$/.test(host) ||
    /\.(localhost|local|internal|lan|home)\.?$/.test(host)
  ) {
    throw new Error('Unsupported ENS gateway URL');
  }
  return url;
}

async function readBoundedText(response: Response): Promise<string> {
  const tooLarge = () => new Error('ENS gateway response too large');
  if (Number(response.headers.get('Content-Length')) > ENS_GATEWAY_MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ENS_GATEWAY_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** EIP-3668 GET/POST transport. viem still verifies sender and callback data onchain. */
export async function requestENSRecord(
  { data, sender, urls }: GatewayRequest,
  signal: AbortSignal,
): Promise<Hex> {
  let failure: unknown = new Error('No supported ENS gateway');
  for (const template of urls.slice(0, 3)) {
    signal.throwIfAborted();
    try {
      const url = gatewayUrl(template, sender, data);
      const method = template.includes('{data}') ? 'GET' : 'POST';
      const response = await globalThis.fetch(url, {
        method,
        signal,
        redirect: 'error',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ data, sender }) : undefined,
      });
      const body = await readBoundedText(response);
      const result = response.headers.get('Content-Type')?.startsWith('application/json')
        ? JSON.parse(body)?.data
        : body;
      if (!response.ok || typeof result !== 'string' || !isHex(result) || result.length % 2 !== 0) {
        throw new Error('Invalid ENS gateway response');
      }
      return result;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

/** Bound the entire record lookup (RPC, gateway, response body, and callback), not just one fetch. */
export async function withENSRecordClient<T>(
  rpcUrl: string,
  read: (client: PublicClient) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error('ENS record lookup timed out');
      controller.abort(error);
      reject(error);
    }, ENS_RECORD_TIMEOUT_MS);
  });
  try {
    const client = createPublicClient({
      transport: http(rpcUrl, { retryCount: 0, fetchOptions: { signal: controller.signal } }),
      ccipRead: { request: request => requestENSRecord(request, controller.signal) },
    });
    return await Promise.race([read(client), deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
