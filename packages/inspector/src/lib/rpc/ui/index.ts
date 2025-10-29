import type { UiClient } from './client';

let uiClientInstance: UiClient | undefined;

export function getUiClient(): UiClient | undefined {
  return uiClientInstance;
}

export function setUiClient(client: UiClient): void {
  uiClientInstance = client;
}
