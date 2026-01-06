import { ListItemButton, ListItemText } from 'decentraland-ui2';

import type { PublishOptionsProps } from './types';

export function PublishOptions({ options }: PublishOptionsProps) {
  return (
    <div className="PublishOptions">
      {options.map(option => (
        <ListItemButton
          key={option.id}
          onClick={option.action}
        >
          <ListItemText primary={option.label} />
        </ListItemButton>
      ))}
    </div>
  );
}
