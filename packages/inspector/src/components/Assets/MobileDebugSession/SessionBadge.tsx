import React from 'react';
import type { MobileDebugSessionSummary } from '../../../lib/logic/mobile-debug-store';

function SessionBadge({ sessions }: { sessions: MobileDebugSessionSummary[] }) {
  if (sessions.length === 0) {
    return <span className="MobileDebugSession-waiting">No session</span>;
  }
  return (
    <div className="MobileDebugSession-sessionBadges">
      {sessions.map(s => {
        const shortId = s.sessionId ? s.sessionId.slice(0, 4) : `#${s.id}`;
        return (
          <span
            key={s.id}
            className="MobileDebugSession-sessionChip"
          >
            {s.deviceName ? `${s.deviceName} - ` : ''}
            Session {shortId}{' '}
            <span className={`MobileDebugSession-badge ${s.status}`}>
              {s.status === 'active' ? 'Active' : 'Ended'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default SessionBadge;
