import React, { useCallback } from 'react';
import { Box, FormGroup, OutlinedInput, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import type { WorldSettings } from '/@/lib/worlds';
import { Row } from '/@/components/Row';
import './styles.css';

/// TODO: get real numbers from backenders
const MAX_COORDINATE = 10000;
const MIN_COORDINATE = -10000;

const formatSpawnPoint = (x: string, y: string) => `${x},${y}`;

type Props = {
  worldSettings: WorldSettings;
  onChangeSpawnPoint: (spawnPoint: string) => void;
};

const TitleDivider = ({ title }: { title: string }) => (
  <Typography className="TitleDivider">
    <span>{title}</span>
    <hr />
  </Typography>
);

const GeneralTab: React.FC<Props> = ({ worldSettings, onChangeSpawnPoint }) => {
  const [x = '', y = ''] = worldSettings.spawnCoordinates?.split(',') || [];

  const validateCoordinate = useCallback((value: string) => {
    const integerRegex = /^-?\d+$/;
    if (!integerRegex.test(value)) return false;

    const numValue = parseInt(value, 10);
    return !isNaN(numValue) && numValue >= MIN_COORDINATE && numValue <= MAX_COORDINATE;
  }, []);

  return (
    <Box className="GeneralTab">
      <FormGroup>
        <TitleDivider title={t('modal.world_settings.tabs.general.world_spawn_coordinate')} />
        <Box className="InputContainer">
          <Typography>{t('modal.world_settings.tabs.general.position')}</Typography>
          <Row>
            <OutlinedInput
              value={x}
              onChange={e => {
                if (validateCoordinate(e.target.value)) {
                  onChangeSpawnPoint(formatSpawnPoint(e.target.value, y));
                }
              }}
              startAdornment={<span className="Label">X</span>}
            />
            <OutlinedInput
              value={y}
              onChange={e => {
                if (validateCoordinate(e.target.value)) {
                  onChangeSpawnPoint(formatSpawnPoint(x, e.target.value));
                }
              }}
              startAdornment={<span className="Label">Y</span>}
            />
          </Row>
        </Box>
      </FormGroup>
    </Box>
  );
};

export { GeneralTab };
