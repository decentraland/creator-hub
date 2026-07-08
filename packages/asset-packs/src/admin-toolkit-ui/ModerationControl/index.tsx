import type { IEngine } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';

import { type GetPlayerDataRes } from '../../types';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { Divider } from '../Primitives';
import { PillButton } from '../Controls';
import { fetchSceneBans } from '..';
import { AddUserInput, PermissionType } from './AddUserInput';

type Props = {
  engine: IEngine;
  player: GetPlayerDataRes | null | undefined;
  sceneAdmins: SceneAdmin[];
};

export type SceneAdmin = {
  name?: string;
  address: string;
  role?: 'owner' | 'operator' | 'admin';
  verified?: boolean;
  canBeRemoved: boolean;
};

type State = {
  showModalAdminList?: boolean;
  adminToRemove?: SceneAdmin;
  showModalBanList?: boolean;
  unbanMessage?: string | null;
};
export const moderationControlState: State = {
  showModalAdminList: false,
  showModalBanList: false,
  adminToRemove: undefined,
  unbanMessage: null as string | null,
};

// The "Banned users can / can't" rules card.
function BanRulesCard() {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        width: '100%',
        borderRadius: RADIUS.md,
        padding: SPACING.lg,
      }}
      uiBackground={{ color: COLORS.surface }}
    >
      <UiEntity uiTransform={{ width: '100%', margin: { bottom: SPACING.md } }}>
        <BanRule
          label="Can't"
          tone="danger"
          text="See your scene, send messages in Nearby chat, or be seen by other users."
        />
      </UiEntity>
      <BanRule
        label="Can still"
        tone="success"
        text="See other users and read messages in Nearby chat."
      />
    </UiEntity>
  );
}

function BanRule({
  label,
  tone,
  text,
}: {
  label: string;
  tone: 'danger' | 'success';
  text: string;
}) {
  const color = tone === 'danger' ? COLORS.danger : COLORS.success;
  const bg = tone === 'danger' ? COLORS.dangerOverlay : COLORS.successBg;
  return (
    <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>
      <UiEntity
        uiTransform={{
          width: 62,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
          padding: { top: 2, bottom: 2 },
          margin: { right: SPACING.md },
          flexShrink: 0,
        }}
        uiBackground={{ color: bg }}
      >
        <Label
          value={`<b>${label}</b>`}
          fontSize={TYPE.small}
          color={color}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{ flexGrow: 1, flexBasis: 0 }}
        uiText={{
          value: text,
          fontSize: TYPE.label,
          color: COLORS.textSecondary,
          textAlign: 'top-left',
          textWrap: 'wrap',
        }}
      />
    </UiEntity>
  );
}

export function ModerationControl({ engine: _engine, player: _player, sceneAdmins }: Props) {
  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', padding: SPACING.xxl }}>
      <Label
        value="<b>Permissions and moderation</b>"
        fontSize={TYPE.title}
        color={COLORS.textPrimary}
        uiTransform={{ margin: { bottom: SPACING.xl } }}
      />

      <AddUserInput
        type={PermissionType.ADMIN}
        sceneAdmins={sceneAdmins}
      />
      <UiEntity uiTransform={{ margin: { top: SPACING.xl }, alignSelf: 'flex-start' }}>
        <PillButton
          id="moderation_control_admin_list"
          label="View admin list"
          iconName="shield"
          variant="outlined"
          onClick={() => (moderationControlState.showModalAdminList = true)}
        />
      </UiEntity>

      <Divider uiTransform={{ margin: { top: SPACING.xl, bottom: SPACING.xl } }} />

      <Label
        value="<b>Ban users</b>"
        fontSize={TYPE.body}
        color={COLORS.textPrimary}
        uiTransform={{ margin: { bottom: SPACING.lg } }}
      />
      <BanRulesCard />

      <UiEntity uiTransform={{ margin: { top: SPACING.xl }, width: '100%' }}>
        <AddUserInput
          type={PermissionType.BAN}
          sceneAdmins={sceneAdmins}
        />
      </UiEntity>
      <UiEntity uiTransform={{ margin: { top: SPACING.xl }, alignSelf: 'flex-start' }}>
        <PillButton
          id="moderation_control_ban_list"
          label="View ban list"
          iconName="ban"
          variant="outlined"
          onClick={async () => {
            await fetchSceneBans();
            moderationControlState.showModalBanList = true;
          }}
        />
      </UiEntity>
    </UiEntity>
  );
}
