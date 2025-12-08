import { IEngine } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { getComponents } from '../definitions';
import { getScaleUIFactor } from '../ui';
import { CONTENT_URL } from './constants';
import { State } from './types';

const ICONS = {
  BTN_CLOSE_TEXT_ANNOUNCEMENT: `${CONTENT_URL}/admin_toolkit/assets/icons/text-announcement-close-button.png`,
  CHAT_MESSAGE_ICON: `${CONTENT_URL}/admin_toolkit/assets/icons/text-announcement-chat-message.png`,
} as const;

let textAnnouncementsHidden: Set<string> = new Set();

export function TextAnnouncements({ engine, state }: { engine: IEngine; state: State }) {
  const { TextAnnouncements } = getComponents(engine);
  const textAnnouncements = TextAnnouncements.getOrNull(state.adminToolkitUiEntity);
  const scaleFactor = getScaleUIFactor(engine);

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
          height: 150 * scaleFactor,
          width: 400 * scaleFactor,
          margin: {
            bottom: 10 * scaleFactor,
          },
          padding: {
            top: 10 * scaleFactor,
            bottom: 10 * scaleFactor,
            left: 10 * scaleFactor,
            right: 10 * scaleFactor,
          },
        }}
        uiBackground={{ color: { r: 0.15, g: 0.15, b: 0.15, a: 0.95 } }}
      >
        <UiEntity
          uiTransform={{
            alignSelf: 'center',
            justifyContent: 'center',
            height: 50 * scaleFactor,
            width: 50 * scaleFactor,
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
          fontSize={18 * scaleFactor}
          value={textAnnouncements.text}
        />
        {textAnnouncements.author ? (
          <Label
            uiTransform={{
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
            }}
            fontSize={14 * scaleFactor}
            color={{ r: 0.7, g: 0.7, b: 0.7, a: 1 }}
            value={`- ${textAnnouncements.author}`}
          />
        ) : null}
        <UiEntity
          uiTransform={{
            height: 24 * scaleFactor,
            width: 24 * scaleFactor,
            positionType: 'absolute',
            position: {
              top: 5 * scaleFactor,
              right: 5 * scaleFactor,
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
