import { useState, useEffect, useCallback } from 'react';
import type { ConnectionInfo } from '/@/lib/connection';
import {
  ConnectionStatus,
  getNetworkInfo,
  onConnectionChange,
  checkConnection,
} from '/@/lib/connection';

interface UseConnectionStatusOptions {
  checkInterval?: number;
  enablePeriodicCheck?: boolean;
}

interface UseConnectionStatusResult extends ConnectionInfo {
  isOnline: boolean;
  checkNow: () => Promise<void>;
}

/**
 * Hook to monitor connection status
 * @param options - Configuration options
 */
export function useConnectionStatus(
  options: UseConnectionStatusOptions = {},
): UseConnectionStatusResult {
  const { checkInterval = 30000, enablePeriodicCheck = false } = options;

  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(() => getNetworkInfo());
  const [isChecking, setIsChecking] = useState(false);

  const checkNow = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    try {
      const isConnected = await checkConnection();
      const info = getNetworkInfo();

      if (!isConnected && info.status !== ConnectionStatus.OFFLINE) {
        setConnectionInfo({ status: ConnectionStatus.OFFLINE });
      } else {
        setConnectionInfo(info);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionInfo({ status: ConnectionStatus.OFFLINE });
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  // listen to online/offline events
  useEffect(() => {
    const cleanup = onConnectionChange(online => {
      if (online) {
        checkNow();
      } else {
        setConnectionInfo({ status: ConnectionStatus.OFFLINE });
      }
    });

    return cleanup;
  }, [checkNow]);

  useEffect(() => {
    if (!enablePeriodicCheck) return;

    const intervalId = setInterval(() => {
      checkNow();
    }, checkInterval);

    return () => clearInterval(intervalId);
  }, [enablePeriodicCheck, checkInterval, checkNow]);

  return {
    ...connectionInfo,
    isOnline: connectionInfo.status === ConnectionStatus.ONLINE,
    checkNow,
  };
}
