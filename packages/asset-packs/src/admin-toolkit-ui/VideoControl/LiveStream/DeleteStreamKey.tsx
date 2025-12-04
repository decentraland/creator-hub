import { IEngine } from '@dcl/ecs';
import { Color4 } from '@dcl/ecs-math';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

import { Button } from '../../Button';
import { LoadingDots } from '../../Loading';
import { Error } from '../../Error';
import { resetStreamKey, revokeStreamKey } from '../api';
import { getComponents } from '../../../definitions';
import { state } from '../..';

export function DeleteStreamKeyConfirmation({
  scaleFactor,
  engine,
  onCancel,
  onReset,
}: {
  scaleFactor: number;
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
        minHeight: 479 * scaleFactor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12 * scaleFactor,
      }}
    >
      <Label
        value="<b>Are you sure you want to reset your Stream Key?</b>"
        fontSize={16 * scaleFactor}
        color={Color4.fromHexString('#FCFCFC')}
      />

      <Label
        value="Active streams using this stream key will be disconnected."
        fontSize={14 * scaleFactor}
        color={Color4.fromHexString('#FFFFFFB2')}
        uiTransform={{
          margin: { top: 6 * scaleFactor, bottom: 24 * scaleFactor },
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
            variant="primary"
            fontSize={18 * scaleFactor}
            color={Color4.Black()}
            uiTransform={{
              width: 90 * scaleFactor,
              height: 40 * scaleFactor,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: { right: 30 * scaleFactor, left: 30 * scaleFactor },
            }}
            onMouseDown={() => onCancel()}
          />
        )}
        {!isLoading && (
          <Button
            id="stream_key_confirm_remove"
            value={'<b>Reset</b>'}
            variant="primary"
            fontSize={18 * scaleFactor}
            color={Color4.White()}
            uiTransform={{
              padding: 8 * scaleFactor,
              height: 40 * scaleFactor,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            uiBackground={{ color: Color4.fromHexString('#FB3B3B') }}
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
              }
            }}
          />
        )}
      </UiEntity>
      {isLoading && (
        <LoadingDots
          scaleFactor={scaleFactor}
          engine={engine}
        />
      )}
      {error && (
        <Error
          scaleFactor={scaleFactor}
          text={error}
        />
      )}
    </UiEntity>
  );
}
