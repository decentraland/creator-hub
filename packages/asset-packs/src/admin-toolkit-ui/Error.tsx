import { Color4 } from '@dcl/ecs-math';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { UiEntity, Label, type UiTransformProps } from '@dcl/react-ecs';
import { getContentUrl } from './constants';

interface ErrorProps {
  text: string;
  uiTransform?: UiTransformProps;
}

export const getErrorIcon = () => `${getContentUrl()}/admin_toolkit/assets/icons/error.png`;

export function Error({ text, uiTransform }: ErrorProps) {
  return (
    <UiEntity
      uiTransform={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        margin: { top: 10 },
        width: '100%',
        ...uiTransform,
      }}
    >
      <UiEntity
        uiTransform={{
          width: 25,
          height: 25,
          margin: { right: 10 },
          flexShrink: 0,
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: {
            src: getErrorIcon(),
          },
        }}
      />
      <Label
        uiTransform={{
          width: 'auto',
          maxWidth: '90%',
        }}
        value={`<b>${text}</b>`}
        color={Color4.Red()}
        fontSize={14}
      />
    </UiEntity>
  );
}
