import { Color4 } from '@dcl/ecs-math';
import ReactEcs, { UiEntity, Label, UiTransformProps } from '@dcl/react-ecs';
import { CONTENT_URL } from './constants';

interface ErrorProps {
  text: string;
  uiTransform?: UiTransformProps;
}

export const ERROR_ICON = `${CONTENT_URL}/admin_toolkit/assets/icons/error.png`;

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
            src: ERROR_ICON,
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
