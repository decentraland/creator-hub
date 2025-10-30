import { MessageTransport } from '@dcl/mini-rpc';
import { UiClient } from './client';

let uiClientInstance: UiClient | undefined;

export function getUiClient(): UiClient | undefined {
  return uiClientInstance;
}

export function createIframeUi(origin: string) {
  if (!window.parent) {
    throw new Error('To use this ui the webapp needs to be inside an iframe');
  }

  const transport = new MessageTransport(window, window.parent, origin);
  const client = new UiClient(transport);
  uiClientInstance = client;
}
