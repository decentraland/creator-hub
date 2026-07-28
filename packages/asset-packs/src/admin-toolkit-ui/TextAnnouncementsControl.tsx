import { type IEngine } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { Label, UiEntity, Input } from '@dcl/react-ecs';
import { type GetPlayerDataRes } from '../types';
import { type State } from './types';
import { COLORS, RADIUS, SPACING, TYPE } from './theme';
import { PillButton, ActionLink } from './Controls';
import { getAdminMessageBus } from './admin-message-bus';
import { setAnnouncementText, clearAnnouncements } from './actions';

export function TextAnnouncementsControl({
  engine,
  state,
  player,
}: {
  engine: IEngine;
  state: State;
  player?: GetPlayerDataRes | null;
}) {
  // Bumping this key re-mounts the (uncontrolled) Input so it visibly empties
  // when the draft is cleared.
  const [clearNonce, setClearNonce] = ReactEcs.useState(0);
  const length = state.textAnnouncementControl.text?.length ?? 0;

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', padding: SPACING.xxl }}>
      <Label
        value="<b>Text announcements</b>"
        fontSize={TYPE.title}
        color={COLORS.textPrimary}
        uiTransform={{ margin: { bottom: SPACING.xl } }}
      />

      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          margin: { bottom: SPACING.sm },
        }}
      >
        <Label
          value="Message"
          fontSize={TYPE.label}
          color={COLORS.textSecondary}
        />
        <Label
          value={`${length} / 90`}
          fontSize={TYPE.label}
          color={COLORS.textSecondary}
        />
      </UiEntity>

      <Input
        key={`announcement-input-${clearNonce}`}
        onSubmit={value => {
          if (!value) return;
          handleSendTextAnnouncement(engine, state, value, player);
          setClearNonce(n => n + 1);
        }}
        onChange={value => setAnnouncementText(value)}
        fontSize={TYPE.body}
        placeholder="Write your announcement…"
        placeholderColor={COLORS.inputPlaceholder}
        color={COLORS.inputText}
        uiBackground={{ color: COLORS.inputBackground }}
        uiTransform={{
          width: '100%',
          height: 110,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.inputBorder,
          margin: { bottom: SPACING.xl },
        }}
      />

      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <ActionLink
          label="Clear all"
          iconName="trash"
          color={COLORS.textSecondary}
          onClick={() => {
            handleClearTextAnnouncement(engine, state);
            setAnnouncementText('');
            setClearNonce(n => n + 1);
          }}
        />
        <PillButton
          id="text_announcement_control_share"
          label="Share"
          iconName="send"
          variant="filled"
          onClick={() => {
            if (!state.textAnnouncementControl.text) return;
            handleSendTextAnnouncement(engine, state, state.textAnnouncementControl.text, player);
            setClearNonce(n => n + 1);
          }}
        />
      </UiEntity>
    </UiEntity>
  );
}

function handleClearTextAnnouncement(_engine: IEngine, _state: State) {
  getAdminMessageBus().emitClearAnnouncement();
  clearAnnouncements();
}

function handleSendTextAnnouncement(
  _engine: IEngine,
  _state: State,
  text: string | undefined,
  player?: GetPlayerDataRes | null,
) {
  if (!text) return;
  const author = player?.name;
  const timestamp = Date.now();
  getAdminMessageBus().emitSetAnnouncement(text.slice(0, 90), author, `${timestamp}-${author}`);
  setAnnouncementText('');
}
