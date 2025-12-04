import { IEngine } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity, Input } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { getComponents } from '../definitions';
import { getScaleUIFactor } from '../ui';
import { GetPlayerDataRes } from '../types';
import { Button } from './Button';
import { CONTENT_URL } from './constants';
import { State } from './types';
import { Header } from './Header';
import { Card } from './Card';

const ICONS = {
  TEXT_ANNOUNCEMENT_CONTROL: `${CONTENT_URL}/admin_toolkit/assets/icons/text-announcement-control.png`,
  CHECK: `${CONTENT_URL}/admin_toolkit/assets/icons/text-announcement-check.png`,
  BTN_CLOSE_TEXT_ANNOUNCEMENT: `${CONTENT_URL}/admin_toolkit/assets/icons/text-announcement-close-button.png`,
  CHAT_MESSAGE_ICON: `${CONTENT_URL}/admin_toolkit/assets/icons/text-announcement-chat-message.png`,
} as const;

let ANNOUNCEMENT_STATE: 'sent' | 'cleared';

export function TextAnnouncementsControl({
  engine,
  state,
  player,
}: {
  engine: IEngine;
  state: State;
  player?: GetPlayerDataRes | null;
}) {
  const scaleFactor = getScaleUIFactor(engine);

  return (
    <Card scaleFactor={scaleFactor}>
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Header
          iconSrc={ICONS.TEXT_ANNOUNCEMENT_CONTROL}
          scaleFactor={scaleFactor}
          title="TEXT ANNOUNCEMENTS"
        />
        <UiEntity uiTransform={{ flexDirection: 'column' }}>
          <Label
            value="<b>Message window</b>"
            fontSize={16 * scaleFactor}
            color={Color4.White()}
            uiTransform={{ margin: { bottom: 16 * scaleFactor } }}
          />

          <Input
            onSubmit={value => {
              handleSendTextAnnouncement(engine, state, value, player);
            }}
            onChange={value => {
              state.textAnnouncementControl.text = value;
            }}
            fontSize={16 * scaleFactor}
            placeholder={'Write your announcement here'}
            placeholderColor={Color4.create(160 / 255, 155 / 255, 168 / 255, 1)}
            color={Color4.Black()}
            uiBackground={{ color: Color4.White() }}
            uiTransform={{
              width: '100%',
              height: 80 * scaleFactor,
              margin: { bottom: 16 * scaleFactor },
            }}
          />

          <UiEntity
            uiTransform={{
              width: '100%',
              height: 40 * scaleFactor,
              flexDirection: 'row',
              margin: {
                bottom: 10 * scaleFactor,
                top: 0,
                right: 0,
                left: 0,
              },
            }}
          >
            <Label
              value={`${state.textAnnouncementControl.text?.length ?? 0} / 90`}
              fontSize={14 * scaleFactor}
              color={Color4.create(187 / 255, 187 / 255, 187 / 255, 1)}
              uiTransform={{ flexGrow: 1 }}
              textAlign="top-left"
            />
            <Button
              id="text_announcement_control_clear"
              value="<b>Clear Announcements</b>"
              variant="text"
              fontSize={16 * scaleFactor}
              color={Color4.White()}
              uiTransform={{
                height: 40 * scaleFactor,
                margin: { right: 8 * scaleFactor },
              }}
              onMouseDown={() => {
                handleClearTextAnnouncement(engine, state);
              }}
            />
            <Button
              id="text_announcement_control_share"
              value="<b>Share</b>"
              variant="primary"
              fontSize={16 * scaleFactor}
              labelTransform={{
                margin: { left: 20 * scaleFactor, right: 20 * scaleFactor },
              }}
              uiTransform={{ height: 40 * scaleFactor }}
              onMouseDown={() => {
                handleSendTextAnnouncement(
                  engine,
                  state,
                  state.textAnnouncementControl.text,
                  player,
                );
              }}
            />
          </UiEntity>
        </UiEntity>

        <UiEntity uiTransform={{ minHeight: 30 * scaleFactor }}>
          <UiEntity
            uiTransform={{
              display: ANNOUNCEMENT_STATE !== undefined ? 'flex' : 'none',
              width: 30 * scaleFactor,
              height: 30 * scaleFactor,
            }}
            uiBackground={{
              texture: { src: ICONS.CHECK },
              textureMode: 'stretch',
            }}
          />
          <Label
            uiTransform={{
              display: ANNOUNCEMENT_STATE !== undefined ? 'flex' : 'none',
            }}
            value={`Message ${ANNOUNCEMENT_STATE === 'sent' ? 'sent' : 'cleared'}!`}
            fontSize={14 * scaleFactor}
            color={Color4.create(187 / 255, 187 / 255, 187 / 255, 1)}
          />
        </UiEntity>
      </UiEntity>
    </Card>
  );
}

function handleClearTextAnnouncement(engine: IEngine, state: State) {
  const { TextAnnouncements } = getComponents(engine);
  const textAnnouncement = TextAnnouncements.getMutableOrNull(state.adminToolkitUiEntity);
  if (textAnnouncement) {
    textAnnouncement.text = '';
    textAnnouncement.id = '';
    textAnnouncement.author = '';
  }
  state.textAnnouncementControl.announcements = [];
  ANNOUNCEMENT_STATE = 'cleared';
}

function handleSendTextAnnouncement(
  engine: IEngine,
  state: State,
  text: string | undefined,
  player?: GetPlayerDataRes | null,
) {
  if (!text) {
    return;
  }

  const { TextAnnouncements } = getComponents(engine);
  const textAnnouncement = TextAnnouncements.getMutableOrNull(state.adminToolkitUiEntity);

  if (textAnnouncement) {
    const author = player?.name;
    // Get current timestamp and ensure uniqueness
    let timestamp = Date.now();

    textAnnouncement.author = author;
    textAnnouncement.id = `${timestamp}-${author}`;
    textAnnouncement.text = text.slice(0, 90);
  }

  state.textAnnouncementControl.text = '';

  ANNOUNCEMENT_STATE = 'sent';

  return;
}
