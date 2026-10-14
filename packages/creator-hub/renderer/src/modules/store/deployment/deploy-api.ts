import { fetch } from '/shared/fetch';
import { seconds } from '/shared/time';
import { delay } from '/shared/utils';

import { type DeployPhase, type DeployState, DeploymentError } from '/@/lib/deploy';
import {
  type DeployPayload,
  DEPLOY_REQUEST_TIMEOUT_MS,
  createDeployRequestError,
  getInitialDeploymentStatus,
} from './utils';

// Client for the deploy resource of the sdk-commands linker server (`/api/deploy`): POST with
// `Prefer: respond-async` starts the deployment, GET follows it, DELETE cancels it.

export const POLL_INTERVAL_MS = seconds(1);
// The server sends a heartbeat every 15 s, so three missed ones mean the stream is gone.
export const STREAM_IDLE_TIMEOUT_MS = seconds(45);
export const MAX_POLL_FAILURES = 10;

const FINAL_PHASES: DeployPhase[] = ['deployed', 'failed', 'cancelled'];

export const isFinalPhase = (phase: DeployPhase) => FINAL_PHASES.includes(phase);

export type ServerSentEvent = { event: string; data: string };

/**
 * Parses the complete events in a text/event-stream buffer.
 *
 * @returns the parsed events and the trailing text of an event that has not ended yet.
 */
export function parseServerSentEvents(buffer: string): {
  events: ServerSentEvent[];
  rest: string;
} {
  const blocks = buffer.replace(/\r\n?/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events = blocks.flatMap(block => {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const separator = line.indexOf(':');
      const field = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      if (field === 'data') data.push(value);
    }
    return data.length > 0 ? [{ event, data: data.join('\n') }] : [];
  });
  return { events, rest };
}

async function discardBody(resp: Response) {
  await resp.body?.cancel().catch(() => undefined);
}

/**
 * Reads the deployment state.
 *
 * @returns the state, or `null` when the CLI predates the deploy resource (404).
 */
export async function fetchDeployState(url: string): Promise<DeployState | null> {
  const resp = await fetch(`${url}/deploy`, { headers: { Accept: 'application/json' } });
  if (resp.status === 404) {
    await discardBody(resp);
    return null;
  }
  if (!resp.ok) {
    await discardBody(resp);
    throw new Error(`Failed to fetch the deployment state: HTTP ${resp.status}`);
  }
  return resp.json();
}

/**
 * Signs the deployment off to the CLI, which uploads it in the background.
 *
 * @returns the state to follow, or `null` when the CLI ignored the preference and already
 * finished the deployment synchronously.
 */
export async function startDeployment(
  url: string,
  payload: DeployPayload,
): Promise<DeployState | null> {
  const resp = await fetch(
    `${url}/deploy`,
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json', Prefer: 'respond-async' },
      body: JSON.stringify(payload),
    },
    DEPLOY_REQUEST_TIMEOUT_MS,
  );

  // 409: this CLI run already started its deployment, so follow that one.
  if (resp.status === 202 || resp.status === 409) return resp.json();

  if (resp.ok) {
    await discardBody(resp);
    return null;
  }

  const data = await resp.json().catch(() => ({}));
  throw createDeployRequestError(data.message ?? `HTTP ${resp.status}`, {
    status: resp.status,
    url,
  });
}

async function readWithTimeout<T>(reader: ReadableStreamDefaultReader<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Deployment stream timed out')), timeoutMs);
  });
  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Follows the state over server-sent events until the stream ends.
 *
 * @returns the last state received, or `null` when the stream could not be opened.
 */
export async function streamDeployState(
  url: string,
  onState: (state: DeployState) => void,
): Promise<DeployState | null> {
  const resp = await fetch(`${url}/deploy`, { headers: { Accept: 'text/event-stream' } });
  if (!resp.ok || !resp.body) {
    await discardBody(resp);
    return null;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let last: DeployState | null = null;
  try {
    while (!last || !isFinalPhase(last.phase)) {
      const { done, value } = await readWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS);
      if (done) break;
      const parsed = parseServerSentEvents(buffer + decoder.decode(value, { stream: true }));
      buffer = parsed.rest;
      for (const { event, data } of parsed.events) {
        if (event !== 'state') continue;
        last = JSON.parse(data) as DeployState;
        onState(last);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return last;
}

/** Polls the JSON state every second until it is final. */
export async function pollDeployState(
  url: string,
  onState: (state: DeployState) => void,
): Promise<DeployState> {
  let failures = 0;
  for (;;) {
    try {
      const state = await fetchDeployState(url);
      if (!state) throw new Error('The deployment is no longer available');
      failures = 0;
      onState(state);
      if (isFinalPhase(state.phase)) return state;
    } catch (error) {
      failures++;
      if (failures >= MAX_POLL_FAILURES) throw error;
    }
    await delay(POLL_INTERVAL_MS);
  }
}

/**
 * Follows the deployment until its final state, over the event stream and, when the stream
 * drops before the end, by polling.
 */
export async function followDeployment(
  url: string,
  onState: (state: DeployState) => void,
): Promise<DeployState> {
  const streamed = await streamDeployState(url, onState).catch(error => {
    console.warn('[DEPLOY] Lost the deployment stream, polling instead:', error);
    return null;
  });
  if (streamed && isFinalPhase(streamed.phase)) return streamed;
  return pollDeployState(url, onState);
}

/**
 * Deploys through the deploy resource, reporting every state change.
 *
 * Resolves when the entity got deployed, and throws a `DEPLOYMENT_CANCELLED` deployment error
 * when it was cancelled or the CLI's error when it failed.
 */
export async function deployWithProgress(
  url: string,
  payload: DeployPayload,
  onState: (state: DeployState) => void,
): Promise<void> {
  const started = await startDeployment(url, payload);
  if (!started) return;
  onState(started);

  const final = isFinalPhase(started.phase) ? started : await followDeployment(url, onState);
  if (final.phase === 'deployed') return;
  if (final.phase === 'cancelled') {
    throw new DeploymentError('DEPLOYMENT_CANCELLED', getInitialDeploymentStatus());
  }
  throw createDeployRequestError(final.error?.message ?? 'Deployment failed', {
    code: final.error?.code,
    url,
  });
}

/** Asks the CLI to cancel the deployment; the final outcome arrives through the state. */
export async function requestDeploymentCancel(url: string): Promise<void> {
  const resp = await fetch(`${url}/deploy`, { method: 'delete' });
  await discardBody(resp);
  // 409: the deployment already reached a final state.
  if (!resp.ok && resp.status !== 409) {
    throw new Error(`Failed to cancel the deployment: HTTP ${resp.status}`);
  }
}
