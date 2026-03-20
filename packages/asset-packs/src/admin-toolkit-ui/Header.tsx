import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

type Props = {
  iconSrc: string;
  title: string;
};

export function Header({ iconSrc, title }: Props) {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'row',
        margin: { bottom: 10 },
        alignItems: 'center',
        height: 'auto',
      }}
    >
      <UiEntity
        uiTransform={{ width: 30, height: 30 }}
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
          fontSize: 24,
          color: Color4.White(),
          textAlign: 'top-left' as const,
          textWrap: 'wrap' as const,
        }}
        uiTransform={{
          margin: { bottom: 2, left: 10 },
        }}
      />
    </UiEntity>
  );
}
