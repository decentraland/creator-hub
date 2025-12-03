import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

type Props = {
  scaleFactor: number;
  iconSrc: string;
  title: string;
};

export function Header({ scaleFactor, iconSrc, title }: Props) {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'row',
        margin: { bottom: 10 * scaleFactor },
        alignItems: 'center',
        height: 'auto',
      }}
    >
      <UiEntity
        uiTransform={{ width: 30 * scaleFactor, height: 30 * scaleFactor }}
        uiBackground={{
          textureMode: 'stretch',
          texture: {
            src: iconSrc,
          },
        }}
      />
      <UiEntity
        uiText={{
          value: `<b>${title}</b>`,
          fontSize: 24 * scaleFactor,
          color: Color4.White(),
          textAlign: 'top-left' as const,
          textWrap: 'wrap' as const,
        }}
        uiTransform={{
          margin: { bottom: 2 * scaleFactor, left: 10 * scaleFactor },
        }}
      />
    </UiEntity>
  );
}
