// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import { COLORS, SPACING, TYPE } from './theme';

type Props = {
  iconSrc: string;
  title: string;
};

export function Header({ iconSrc, title }: Props) {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'row',
        margin: { bottom: SPACING.md },
        alignItems: 'center',
        height: 'auto',
      }}
    >
      <UiEntity
        uiTransform={{ width: 26, height: 26 }}
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
          fontSize: TYPE.title,
          color: COLORS.textPrimary,
          textAlign: 'middle-left' as const,
          textWrap: 'wrap' as const,
        }}
        uiTransform={{
          margin: { left: SPACING.sm },
        }}
      />
    </UiEntity>
  );
}
