import React, { useCallback } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  OutlinedInput,
  Typography,
} from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';
import type { WorldSettings } from '/@/lib/worlds';
import { coordsToId, idToCoords } from '/@/lib/land';
import { Row } from '/@/components/Row';
import { RangeHourField, MIDDAY_SECONDS } from '/@/components/RangeHourField';
import './styles.css';

const INTEGER_REGEX = /^-?\d+$/;

type Props = {
  worldSettings: WorldSettings;
  onChangeSettings: (settings: Partial<WorldSettings>) => void;
};

const TitleDivider = ({ title }: { title: string }) => (
  <Typography className="TitleDivider">
    <span>{title}</span>
    <hr />
  </Typography>
);

const GeneralTab: React.FC<Props> = ({ worldSettings, onChangeSettings }) => {
  const [x, y] = idToCoords(worldSettings.spawnCoordinates || '');
  const isSkyboxAuto = worldSettings.skyboxTime === undefined || worldSettings.skyboxTime === null;

  const validateCoordinate = useCallback((value: string) => {
    if (value === '') return true;
    if (!INTEGER_REGEX.test(value)) return false;
    const numValue = parseInt(value, 10);
    return !isNaN(numValue) && numValue >= MIN_COORDINATE && numValue <= MAX_COORDINATE;
  }, []);

  return (
    <Box className="GeneralTab">
      <FormGroup>
        <TitleDivider title={t('modal.world_settings.general.world_spawn_coordinate')} />
        <Box className="InputContainer">
          <Typography variant="body2">{t('modal.world_settings.general.position')}</Typography>
          <Row>
            <OutlinedInput
              value={x}
              onChange={e => {
                if (validateCoordinate(e.target.value)) {
                  onChangeSettings({ spawnCoordinates: coordsToId(e.target.value, y) });
                }
              }}
              startAdornment={<span className="Label">X</span>}
            />
            <OutlinedInput
              value={y}
              onChange={e => {
                if (validateCoordinate(e.target.value)) {
                  onChangeSettings({ spawnCoordinates: coordsToId(x, e.target.value) });
                }
              }}
              startAdornment={<span className="Label">Y</span>}
            />
          </Row>
        </Box>
      </FormGroup>
      <FormGroup>
        <TitleDivider title={t('modal.world_settings.general.world_skybox')} />
        <FormControlLabel
          control={
            <Checkbox
              checked={isSkyboxAuto}
              onChange={e =>
                onChangeSettings({ skyboxTime: e.target.checked ? null : MIDDAY_SECONDS })
              }
            />
          }
          label={t('modal.world_settings.general.auto_skybox')}
        />
        <Typography variant="body2">{t('modal.world_settings.general.max_offset')}</Typography>
        <RangeHourField
          value={worldSettings.skyboxTime ?? MIDDAY_SECONDS}
          disabled={isSkyboxAuto}
          onChange={e => onChangeSettings({ skyboxTime: parseInt(e.target.value) })}
        />
      </FormGroup>
      <FormGroup>
        <TitleDivider title={t('modal.world_settings.general.general')} />
        <FormControlLabel
          control={<Checkbox />}
          label={t('modal.world_settings.general.single_player')}
        />
      </FormGroup>
    </Box>
  );
};

export { GeneralTab };
