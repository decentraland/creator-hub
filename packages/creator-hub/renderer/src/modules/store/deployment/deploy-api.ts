import { fetch } from '/shared/fetch';
import { seconds } from '/shared/time';
import { delay } from '/shared/utils';

import type { DeployServer } from '/shared/types/deploy';

import { type DeployPhase, type DeployState, DeploymentError } from '/@/lib/deploy';
import {
  type DeployPayload,
  DEPLOY_REQUEST_TIMEOUT_MS,
  discardBody,
  getDeploymentUrl,
  getInitialDeploymentStatus,
  reportDeployRequestError,
} from './utils';

// Client for the deploy resource of the sdk-commands linker server (`/api/deploy`): POST with
// `Prefer: respond-async` starts the deployment, GET follows it, DELETE cancels it.

const POLL_INTERVAL_MS = seconds(1);
// The server sends a heartbeat every 15 s, so three missed ones mean the stream is gone.
const STREAM_IDLE_TIMEOUT_MS = seconds(45);
export const MAX_POLL_FAILURES = 10;

// Authorizes cancelling the deployment of the CLI main runs (one at a time). Kept out of the
// store, whose actions and states redux-logger prints to the console.
let current: { url: string; token: string } | undefined;

/**
 * Adopts the CLI main started for a deployment, keeping its cancel token. Main stops the
 * previous CLI, so the previous token goes.
 */
export function registerDeployServer({ port, supportsDeployResource, deployToken }: DeployServer) {
  const url = getDeploymentUrl(port);
  current = url && deployToken ? { url, token: deployToken } : undefined;
  return { url, supportsDeployResource, hasCancelToken: !!current };
}

function getDeployToken(url: string) {
  return current?.url === url ? current.token : undefined;
}

const FINAL_PHASES: DeployPhase[] = ['deployed', 'failed', 'cancelled'];

export const isFinalPhase = (phase: DeployPhase) => FINAL_PHASES.includes(phase);

const DEPLOY_PHASES: readonly DeployPhase[] = [
  'awaiting-signature',
  'undeploying',
  'uploading',
  ...FINAL_PHASES,
];

const isDeployState = (value: unknown): value is DeployState =>
  typeof value === 'object' &&
  value !== null &&
  'phase' in value &&
  DEPLOY_PHASES.some(phase => phase === value.phase);

type ServerSentEvent = { event: string; data: string };

/**
 * Parses the complete events in a text/event-stream buffer.
 *
 * @returns the parsed events and the trailing text of an event that has not ended yet.
 */
export function parseServerSentEvents(buffer: string): {
  events: ServerSentEvent[];
  rest: string;
} {
  // A trailing CR may be the first half of a CRLF split across chunks: normalizing it now
  // would count that CRLF as two line breaks, ending the event early.
  const pendingCR = buffer.endsWith('\r') ? '\r' : '';
  const blocks = buffer
    .slice(0, buffer.length - pendingCR.length)
    .replace(/\r\n?/g, '\n')
    .split('\n\n');
  const rest = (blocks.pop() ?? '') + pendingCR;
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

/**
 * Checks whether the CLI serves the deploy resource. Anything but a 2xx or 409 (a 4xx from a
 * CLI that predates it, a 5xx, no answer) falls back to the blocking request.
 */
export async function isDeployResourceAvailable(url: string): Promise<boolean> {
  try {
    const resp = await fetch(`${url}/deploy`, { headers: { Accept: 'application/json' } });
    await discardBody(resp);
    return resp.ok || resp.status === 409;
  } catch {
    return false;
  }
}

async function fetchDeployState(url: string): Promise<DeployState> {
  const resp = await fetch(`${url}/deploy`, { headers: { Accept: 'application/json' } });
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
async function startDeployment(url: string, payload: DeployPayload): Promise<DeployState | null> {
  const resp = await fetch(
    `${url}/deploy`,
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json', Prefer: 'respond-async' },
      body: JSON.stringify(payload),
    },
    DEPLOY_REQUEST_TIMEOUT_MS,
  );

  // 409: this CLI run already started its deployment, so follow that one. The CLI has it from
  // here on, so failing to read the state must not deploy again.
  if (resp.status === 202 || resp.status === 409) {
    const state: unknown = await resp.json().catch(error => {
      throw new DeploymentError('DEPLOY_STATE_LOST', getInitialDeploymentStatus(), error);
    });
    if (!isDeployState(state)) {
      throw new DeploymentError(
        'DEPLOY_STATE_LOST',
        getInitialDeploymentStatus(),
        new Error('The CLI answered without a deployment state'),
      );
    }
    return state;
  }

  if (resp.ok) {
    await discardBody(resp);
    return null;
  }

  const data = await resp.json().catch(() => ({}));
  throw reportDeployRequestError(data.message ?? `HTTP ${resp.status}`, {
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
async function streamDeployState(
  url: string,
  onState: (state: DeployState) => void,
  deadline: number,
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
      const timeoutMs = Math.max(0, Math.min(STREAM_IDLE_TIMEOUT_MS, deadline - Date.now()));
      const { done, value } = await readWithTimeout(reader, timeoutMs);
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
async function pollDeployState(
  url: string,
  onState: (state: DeployState) => void,
  deadline: number,
): Promise<DeployState> {
  let failures = 0;
  for (;;) {
    if (Date.now() >= deadline) throw new Error('The deployment did not finish in time');
    try {
      const state = await fetchDeployState(url);
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
 * drops before the end, by polling. Gives up after `DEPLOY_REQUEST_TIMEOUT_MS` in total, the
 * same time the blocking request allows.
 */
async function followDeployment(
  url: string,
  onState: (state: DeployState) => void,
): Promise<DeployState> {
  const deadline = Date.now() + DEPLOY_REQUEST_TIMEOUT_MS;
  const streamed = await streamDeployState(url, onState, deadline).catch(error => {
    console.warn('[DEPLOY] Lost the deployment stream, polling instead:', error);
    return null;
  });
  if (streamed && isFinalPhase(streamed.phase)) return streamed;
  return pollDeployState(url, onState, deadline);
}

/**
 * Deploys through the deploy resource, reporting every state change.
 *
 * Resolves when the entity got deployed. Throws a `DEPLOYMENT_CANCELLED` deployment error when
 * it was cancelled, a `DEPLOY_STATE_LOST` one when the outcome could not be followed (the
 * CLI may still publish it), or the CLI's error when it failed.
 */
export async function deployWithProgress(
  url: string,
  payload: DeployPayload,
  onState: (state: DeployState) => void,
): Promise<void> {
  try {
    const started = await startDeployment(url, payload);
    if (!started) return;
    onState(started);

    const final = isFinalPhase(started.phase)
      ? started
      : await followDeployment(url, onState).catch(error => {
          throw new DeploymentError('DEPLOY_STATE_LOST', getInitialDeploymentStatus(), error);
        });
    if (final.phase === 'deployed') return;
    if (final.phase === 'cancelled') {
      throw new DeploymentError('DEPLOYMENT_CANCELLED', getInitialDeploymentStatus());
    }
    throw reportDeployRequestError(final.error?.message ?? 'Deployment failed', {
      code: final.error?.code,
      url,
    });
  } finally {
    // The deployment is over (or no longer followed), so there is nothing left to cancel. On
    // DEPLOY_STATE_LOST the CLI may still publish, but the status leaves pending and Cancel hides.
    if (current?.url === url) current = undefined;
  }
}

/** Why the CLI turned a cancellation down. */
export type CancelRejection = 'too-early' | 'unauthorized';

/**
 * Asks the CLI to cancel the deployment; the final outcome arrives through the state.
 *
 * @returns `null` when the CLI took the request (or the deployment already ended), otherwise
 * why it turned it down: `too-early` while it is still removing the previous scenes,
 * `unauthorized` when it does not accept the token.
 */
export async function requestDeploymentCancel(url: string): Promise<CancelRejection | null> {
  const deployToken = getDeployToken(url);
  const resp = await fetch(`${url}/deploy`, {
    method: 'delete',
    headers: deployToken ? { 'X-Deploy-Token': deployToken } : undefined,
  });
  if (resp.status === 403) {
    await discardBody(resp);
    return 'unauthorized';
  }
  if (resp.status === 409) {
    const state: DeployState | null = await resp.json().catch(() => null);
    return state && !isFinalPhase(state.phase) ? 'too-early' : null;
  }
  await discardBody(resp);
  if (!resp.ok) throw new Error(`Failed to cancel the deployment: HTTP ${resp.status}`);
  return null;
}
