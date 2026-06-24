import type { IEngine } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { UiEntity } from '@dcl/react-ecs';

import { type GetPlayerDataRes } from '../../types';
import { getContentUrl } from '../constants';
import { Header } from '../Header';
import { Button } from '../Button';
import { Card } from '../Card';
import { fetchSceneBans } from '..';
import { AddUserInput, PermissionType } from './AddUserInput';
import {
  getModerationControlStyles,
  getModerationControlColors,
} from './styles/ModerationControlStyles';

type Props = {
  engine: IEngine;
  player: GetPlayerDataRes | null | undefined;
  sceneAdmins: SceneAdmin[];
};

export const getBtnModerationControl = () =>
  `${getContentUrl()}/admin_toolkit/assets/icons/admin-panel-moderation-control-button.png`;
const MODERATION_ICONS = {
  get MODERATION_CONTROL_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/moderation-control-icon.png`;
  },
  get VERIFIED_USER_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/admin-panel-verified-user.png`;
  },
  get BAN_USER_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/ban.png`;
  },
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

export function ModerationControl({ engine: _engine, player: _player, sceneAdmins }: Props) {
  const styles = getModerationControlStyles();
  const colors = getModerationControlColors();

  return (
    <Card>
      <UiEntity uiTransform={styles.container}>
        <Header
          iconSrc={MODERATION_ICONS.MODERATION_CONTROL_ICON}
          title="PERMISSIONS & MODERATION"
        />
        <AddUserInput
          type={PermissionType.ADMIN}
          sceneAdmins={sceneAdmins}
        />
        <Button
          variant="secondary"
          id="moderation_control_admin_list"
          value="<b>View Admin List</b>"
          fontSize={18}
          color={colors.white}
          uiTransform={styles.viewListButton}
          icon={MODERATION_ICONS.VERIFIED_USER_ICON}
          iconTransform={styles.viewListIcon}
          onMouseDown={() => (moderationControlState.showModalAdminList = true)}
        />
        <UiEntity uiTransform={styles.divider} />
        <AddUserInput
          type={PermissionType.BAN}
          sceneAdmins={sceneAdmins}
        />
        <Button
          variant="secondary"
          id="moderation_control_ban_list"
          value="<b>View Ban List</b>"
          fontSize={18}
          color={colors.white}
          uiTransform={styles.viewListButton}
          icon={MODERATION_ICONS.BAN_USER_ICON}
          iconTransform={styles.viewListIcon}
          onMouseDown={async () => {
            await fetchSceneBans();
            moderationControlState.showModalBanList = true;
          }}
        />
      </UiEntity>
    </Card>
  );
}
