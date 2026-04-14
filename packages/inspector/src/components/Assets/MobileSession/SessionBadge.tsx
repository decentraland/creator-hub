import React from 'react';
import type { SessionInfo } from '../../../lib/logic/scene-log-store';

function SessionBadge({ sessions }: { sessions: SessionInfo[] }) {
  if (sessions.length === 0) {
    return <span className="MobileSession-waiting">No session</span>;
  }
  return (
    <div className="MobileSession-sessionBadges">
      {sessions.map(s => {
        const shortId = s.sessionId ? s.sessionId.slice(0, 4) : `#${s.id}`;
        return (
          <span
            key={s.id}
            className="MobileSession-sessionChip"
          >
            {s.deviceName ? `${s.deviceName} - ` : ''}
            Session {shortId}{' '}
            <span className={`MobileSession-badge ${s.status}`}>
              {s.status === 'active' ? 'Active' : 'Ended'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default SessionBadge;
