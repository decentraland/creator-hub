import React from 'react';

import './EmptyState.css';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

// Shared empty / first-run state for the UI Designer panels (canvas, properties,
// variables, roots). Replaces the bare one-line text placeholders with an icon +
// title + guidance + optional call-to-action, so an empty editor reads as
// intentional onboarding rather than a broken panel.
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

export default EmptyState;
