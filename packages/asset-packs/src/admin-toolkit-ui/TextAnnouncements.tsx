import type { IEngine } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { getComponents } from '../definitions';
import { getContentUrl } from './constants';
import { COLORS, RADIUS, TYPE } from './theme';
import type { State } from './types';

const ICONS = {
  get BTN_CLOSE_TEXT_ANNOUNCEMENT() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/text-announcement-close-button.png`;
  },
  get CHAT_MESSAGE_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/text-announcement-chat-message.png`;
  },
};

const textAnnouncementsHidden: Set<string> = new Set();

export function TextAnnouncements({ engine, state }: { engine: IEngine; state: State }) {
  const { TextAnnouncements } = getComponents(engine);
  const textAnnouncements = TextAnnouncements.getOrNull(state.adminToolkitUiEntity);

  if (!textAnnouncements?.text || textAnnouncementsHidden.has(textAnnouncements.id)) {
    return null;
  }

  return (
    <UiEntity
      uiTransform={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
        width: '100%',
      }}
    >
      <UiEntity
        key={textAnnouncements.id}
        uiTransform={{
          display: 'flex',
          flexDirection: 'column',
          height: 150,
          width: 400,
          margin: {
            bottom: 10,
          },
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          },
          borderRadius: RADIUS.md,
        }}
        uiBackground={{ color: COLORS.panel }}
      >
        <UiEntity
          uiTransform={{
            alignSelf: 'center',
            justifyContent: 'center',
            height: 50,
            width: 50,
          }}
          uiBackground={{
            texture: {
              src: ICONS.CHAT_MESSAGE_ICON,
            },
            textureMode: 'stretch',
            color: { r: 1, g: 1, b: 1, a: 1 },
          }}
        />
        <Label
          uiTransform={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
          fontSize={TYPE.subtitle}
          color={COLORS.textPrimary}
          value={textAnnouncements.text}
        />
        {textAnnouncements.author ? (
          <Label
            uiTransform={{
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
            }}
            fontSize={TYPE.caption}
            color={COLORS.textSecondary}
            value={`- ${textAnnouncements.author}`}
          />
        ) : null}
        <UiEntity
          uiTransform={{
            height: 24,
            width: 24,
            positionType: 'absolute',
            position: {
              top: 5,
              right: 5,
            },
          }}
          uiBackground={{
            texture: {
              src: ICONS.BTN_CLOSE_TEXT_ANNOUNCEMENT,
            },
            textureMode: 'stretch',
          }}
          onMouseDown={() => {
            textAnnouncementsHidden.add(textAnnouncements.id);
          }}
        />
      </UiEntity>
    </UiEntity>
  );
}
