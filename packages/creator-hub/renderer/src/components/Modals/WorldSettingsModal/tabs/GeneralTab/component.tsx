import React, { useCallback, useEffect, useState } from 'react';
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

type FormState = {
  x: string;
  y: string;
};

const TitleDivider = ({ title }: { title: string }) => (
  <Typography className="TitleDivider">
    <span>{title}</span>
    <hr />
  </Typography>
);

const GeneralTab: React.FC<Props> = ({ worldSettings, onChangeSettings }) => {
  const [x, y] = idToCoords(worldSettings.spawnCoordinates || '');
  const [form, setForm] = useState<FormState>({ x: x.toString(), y: y.toString() });
  const isSkyboxAuto = worldSettings.skyboxTime === undefined || worldSettings.skyboxTime === null;
  const validateCoordinate = useCallback((value: string) => {
    if (!INTEGER_REGEX.test(value)) return false;
    const numValue = parseInt(value, 10);
    return !isNaN(numValue) && numValue >= MIN_COORDINATE && numValue <= MAX_COORDINATE;
  }, []);

  const handleCoordinateChange = useCallback(
    (value: string, axis: 'x' | 'y') => {
      if (validateCoordinate(value) || value === '' || value === '-') {
        setForm(prev => ({ ...prev, [axis]: value }));
      }

      const newX = axis === 'x' ? value : form.x;
      const newY = axis === 'y' ? value : form.y;
      if (validateCoordinate(newX) && validateCoordinate(newY)) {
        onChangeSettings({ spawnCoordinates: coordsToId(parseInt(newX), parseInt(newY)) });
      } else {
        onChangeSettings({ spawnCoordinates: undefined });
      }
    },
    [validateCoordinate, onChangeSettings, form],
  );

  useEffect(() => {
    if (x !== '' && y !== '') {
      setForm({ x: x.toString(), y: y.toString() });
    }
  }, [worldSettings.spawnCoordinates]);

  return (
    <Box className="GeneralTab">
      <FormGroup>
        <TitleDivider title={t('modal.world_settings.general.world_spawn_coordinate')} />
        <Box className="InputContainer">
          <Typography variant="body2">{t('modal.world_settings.general.position')}</Typography>
          <Row>
            <OutlinedInput
              value={form.x}
              onChange={e => handleCoordinateChange(e.target.value, 'x')}
              startAdornment={<span className="Label">X</span>}
            />
            <OutlinedInput
              value={form.y}
              onChange={e => handleCoordinateChange(e.target.value, 'y')}
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
          control={
            <Checkbox
              checked={worldSettings.singlePlayer || false}
              onChange={e => onChangeSettings({ singlePlayer: e.target.checked })}
            />
          }
          label={t('modal.world_settings.general.single_player')}
        />
      </FormGroup>
    </Box>
  );
};

export { GeneralTab };
