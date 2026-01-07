import { useCallback } from 'react';
import { Checkbox, FormControlLabel, FormGroup } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import type { PreviewOptionsProps } from './types';

export function PreviewOptions({ onChange, options }: PreviewOptionsProps) {
  const handleChange = useCallback(
    (newOptions: Partial<PreviewOptionsProps['options']>) => () => {
      onChange({ ...options, ...newOptions });
    },
    [onChange, options],
  );

  return (
    <div className="PreviewOptions">
      <span className="title">{t('editor.header.actions.preview_options.title')}</span>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!options.debugger}
              onChange={handleChange({ debugger: !options.debugger })}
            />
          }
          label={t('editor.header.actions.preview_options.debugger')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={!!options.enableLandscapeTerrains}
              onChange={handleChange({ enableLandscapeTerrains: !options.enableLandscapeTerrains })}
            />
          }
          label={t('editor.header.actions.preview_options.landscape_terrain_enabled')}
        />
      </FormGroup>
    </div>
  );
}
