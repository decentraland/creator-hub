import React from 'react';

import './EmptyState.css';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}

/** Shared empty / first-run state for the UI Designer panels: icon, title, guidance, optional CTA. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => (
  <div className="ui-designer-empty-state">
    {icon ? (
      <div
        className="ui-designer-empty-state-icon"
        aria-hidden="true"
      >
        {icon}
      </div>
    ) : null}
    <p className="ui-designer-empty-state-title">{title}</p>
    {message ? <p className="ui-designer-empty-state-message">{message}</p> : null}
    {action ? <div className="ui-designer-empty-state-action">{action}</div> : null}
  </div>
);

/** Names a real control inside empty-state copy so the instruction points at something findable. */
export const EmptyStateChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="ui-designer-empty-state-chip">{children}</span>
);

export default EmptyState;
