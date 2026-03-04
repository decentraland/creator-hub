import { Color4 } from '@dcl/sdk/math';
import { IEngine } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';
import { Button } from '../../Button';
import { Error } from '../../Error';
import { generateStreamKey, getStreamKey } from '../api';
import { LoadingDots } from '../../Loading';
import { getComponents } from '../../../definitions';
import { state } from '../..';

export function GenerateStreamKey({
  engine,
  onGenerate,
}: {
  engine: IEngine;
  onGenerate: () => void;
}) {
  const [loading, setLoading] = ReactEcs.useState<boolean>(false);
  const [error, setError] = ReactEcs.useState<string>('');
  const { VideoControlState } = getComponents(engine);

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 460,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {loading ? (
        <UiEntity uiTransform={{ flexDirection: 'column' }}>
          <LoadingDots engine={engine} />
          <Label
            value="Generating your Stream Key"
            color={Color4.fromHexString('#A09BA8')}
            fontSize={16}
            uiTransform={{ margin: { top: 16 } }}
          />
        </UiEntity>
      ) : (
        <UiEntity uiTransform={{ flexDirection: 'column' }}>
          <UiEntity uiTransform={{ justifyContent: 'center', width: '100%' }}>
            <Button
              id="video_control_live_generate_key"
              value="<b>Get Stream Key</b>"
              fontSize={18}
              uiTransform={{
                height: 52,
                padding: 16,
                margin: { bottom: 16 },
              }}
              onMouseDown={async () => {
                setLoading(true);
                const [error, data] = await generateStreamKey();
                setLoading(false);
                if (error) {
                  setError(error);
                } else if (data) {
                  const videoControl = VideoControlState.getMutable(state.adminToolkitUiEntity);
                  videoControl.endsAt = data.endsAt;
                  onGenerate();
                }
              }}
            />
          </UiEntity>
          {error && (
            <Error
              text={error}
              uiTransform={{ margin: { top: 16 } }}
            />
          )}
        </UiEntity>
      )}
    </UiEntity>
  );
}
