import React, { useCallback, useState } from 'react';
import * as mobileDebugStore from '../../../lib/logic/mobile-debug-store';
import { getSceneClient } from '../../../lib/rpc/scene';

function useMobileDebugCommand() {
  return useCallback(async (cmd: string, args: Record<string, unknown> = {}) => {
    const client = getSceneClient();
    if (!client) return null;
    try {
      return await client.broadcastMobileDebugCommand(cmd, args);
    } catch {
      return null;
    }
  }, []);
}

interface Props {
  isPaused: boolean;
  hasSession: boolean;
}

function CommandToolbar({ isPaused, hasSession }: Props) {
  const sendCommand = useMobileDebugCommand();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCommand = useCallback(
    async (cmd: string, args: Record<string, unknown> = {}) => {
      setLoading(cmd);
      const result = await sendCommand(cmd, args);
      if (result?.ok && (cmd === 'pause' || cmd === 'resume')) {
        mobileDebugStore.setIsPaused(cmd === 'pause');
      }
      setLoading(null);
    },
    [sendCommand],
  );

  if (!hasSession) return null;

  return (
    <div className="MobileDebugSession-toolbar">
      <button
        className={`MobileDebugSession-cmd ${isPaused ? 'paused' : ''}`}
        onClick={() => handleCommand(isPaused ? 'resume' : 'pause')}
        disabled={loading !== null}
        title={isPaused ? 'Resume scene' : 'Pause scene'}
      >
        {isPaused ? '\u25B6' : '\u23F8'}
      </button>
      <button
        className="MobileDebugSession-cmd"
        onClick={() => handleCommand('reload_scene')}
        disabled={loading !== null}
        title="Reload scene"
      >
        {'\u21BB'}
      </button>
      {isPaused && <span className="MobileDebugSession-pausedBadge">PAUSED</span>}
    </div>
  );
}

export default CommandToolbar;
