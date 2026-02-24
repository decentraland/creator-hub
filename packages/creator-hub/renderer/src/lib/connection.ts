import { fetch } from '/shared/fetch';

export enum ConnectionStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export interface ConnectionInfo {
  status: ConnectionStatus;
}

export function isNavigatorOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Get connection information from Network Information API
 */
export function getNetworkInfo(): ConnectionInfo {
  const navigatorOnline = isNavigatorOnline();

  if (!navigatorOnline) {
    return { status: ConnectionStatus.OFFLINE };
  }

  return { status: ConnectionStatus.ONLINE };
}

/**
 * Check connection by attempting to fetch a small resource with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise<boolean> - true if connection successful
 */
export async function checkConnection(timeoutMs: number = 5000): Promise<boolean> {
  if (!isNavigatorOnline()) {
    return false;
  }

  try {
    const response = await fetch(
      'https://decentraland.org/favicon.ico?_=' + Date.now(),
      {
        method: 'HEAD',
        cache: 'no-store',
      },
      timeoutMs,
    );
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Add event listeners for online/offline changes
 * @param callback - Function to call when connection status changes
 * @returns Function to remove event listeners
 */
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
