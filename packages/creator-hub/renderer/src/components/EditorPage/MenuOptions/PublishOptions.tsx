import { useCallback } from 'react';
import { ListItemButton, ListItemText } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import type { PublishOptionsProps, PublishOption } from './types';

export function PublishOptions({ project, isDeploying, onClick }: PublishOptionsProps) {
  const handleClick = useCallback(
    (id: PublishOption['id']) => () => {
      onClick({ id });
    },
    [onClick],
  );

  const worldName = project?.worldConfiguration?.name;
  const landBase = project?.scene?.base;

  return (
    <div className="PublishOptions">
      {isDeploying && (
        <ListItemButton onClick={handleClick('publish-scene')}>
          <ListItemText primary={t('editor.header.actions.publish_options.publish_scene')} />
        </ListItemButton>
      )}
      {worldName && (
        <ListItemButton onClick={handleClick('deploy-world')}>
          <ListItemText
            primary={t('editor.header.actions.publish_options.republish_to_world', {
              name: worldName,
            })}
          />
        </ListItemButton>
      )}
      {!worldName && landBase && project?.scene?.base !== '0,0' && (
        <ListItemButton onClick={handleClick('deploy-land')}>
          <ListItemText
            primary={t('editor.header.actions.publish_options.republish_to_land', {
              coords: landBase,
            })}
          />
        </ListItemButton>
      )}
    </div>
  );
}
