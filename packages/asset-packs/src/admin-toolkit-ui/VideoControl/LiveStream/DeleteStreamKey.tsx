import type { IEngine } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

import { Button } from '../../Button';
import { LoadingDots } from '../../Loading';
import { Error } from '../../Error';
import { resetStreamKey } from '../api';
import { getComponents } from '../../../definitions';
import { COLORS, TYPE } from '../../theme';
import { state } from '../../store';

export function DeleteStreamKeyConfirmation({
  engine,
  onCancel,
  onReset,
}: {
  engine: IEngine;
  onCancel(): void;
  onReset(): void;
}) {
  const [isLoading, setIsLoading] = ReactEcs.useState(false);
  const [error, setError] = ReactEcs.useState('');
  const { VideoControlState } = getComponents(engine);

  return (
    <UiEntity
      uiTransform={{
        minHeight: 479,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
      }}
    >
      <Label
        value="<b>Are you sure you want to reset your Stream Key?</b>"
        fontSize={TYPE.subtitle}
        color={COLORS.textPrimary}
      />

      <Label
        value="Active streams using this stream key will be disconnected."
        fontSize={TYPE.body}
        color={COLORS.textSecondary}
        uiTransform={{
          margin: { top: 6, bottom: 24 },
        }}
      />

      <UiEntity
        uiTransform={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {!isLoading && (
          <Button
            id="stream_key_cancel_remove"
            value="<b>Cancel</b>"
            variant="secondary"
            fontSize={TYPE.button}
            color={COLORS.textPrimary}
            uiTransform={{
              width: 90,
              height: 40,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: { right: 30, left: 30 },
            }}
            onMouseDown={() => onCancel()}
          />
        )}
        {!isLoading && (
          <Button
            id="stream_key_confirm_remove"
            value={'<b>Reset</b>'}
            variant="primary"
            fontSize={TYPE.button}
            uiTransform={{
              padding: 8,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onMouseDown={async () => {
              setIsLoading(true);
              const [error, data] = await resetStreamKey();
              if (error) {
                setError(error);
                setIsLoading(false);
              } else {
                const videoControl = VideoControlState.getMutable(state.adminToolkitUiEntity);
                videoControl.endsAt = data?.endsAt;
                onReset();
                setIsLoading(false);
              }
            }}
          />
        )}
      </UiEntity>
      {isLoading && <LoadingDots engine={engine} />}
      {error && <Error text={error} />}
    </UiEntity>
  );
}
