import type { IEngine } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';

import { getScaleUIFactor } from '../ui';
import { Card } from './Card';
import { Header } from './Header';
import { CONTENT_URL } from './constants';
import type { State } from './types';

// Using a generic control icon, we can update this if there's a specific logs icon
const ICONS = {
  LOGS_CONTROL: `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-control-button.png`,
} as const;

export function LogsControl({ engine, state }: { engine: IEngine; state: State }) {
  const scaleFactor = getScaleUIFactor(engine);

  return (
    <Card scaleFactor={scaleFactor}>
      <UiEntity
        key="LogsControl"
        uiTransform={{
          height: '100%',
          width: '100%',
          flexDirection: 'column',
        }}
      >
        <Header
          iconSrc={ICONS.LOGS_CONTROL}
          title="INITIALIZATION LOGS"
          scaleFactor={scaleFactor}
        />

        <UiEntity
          uiTransform={{
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: 8 * scaleFactor,
            overflow: 'hidden',
          }}
        >
          {state.logs.map((log, index) => (
            <Label
              key={`log_${index}`}
              value={log}
              fontSize={12 * scaleFactor}
              color={Color4.White()}
              uiTransform={{
                width: '100%',
                minHeight: 20 * scaleFactor,
                margin: { bottom: 8 * scaleFactor },
              }}
              textAlign="middle-left"
            />
          ))}
        </UiEntity>
      </UiEntity>
    </Card>
  );
}
