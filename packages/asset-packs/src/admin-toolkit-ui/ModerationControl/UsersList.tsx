import { type IEngine } from '@dcl/ecs';
import { Color4 } from '@dcl/ecs-math';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';

import { getContentUrl } from '../constants';
import { Button } from '../Button';
import { clearInterval, setInterval } from '../utils';
import { RemoveAdminConfirmation } from './RemoveAdminConfirmation';
import { type SceneBanUser } from './api';
import { handleUnbanUser } from './utils';
import { moderationControlState, type SceneAdmin } from './.';
import {
  getModalStyles,
  getModalBackgrounds,
  getModalColors,
  getPaginationColor,
} from './styles/UsersListStyles';

export enum UserListType {
  ADMIN = 'admin',
  BAN = 'ban',
}

type ModalUserListProps = {
  users: SceneAdmin[] | SceneBanUser[];
  engine: IEngine;
  type: UserListType;
};
const USERS_PER_PAGE = 5;

const ICONS = {
  get BACK() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/chevron-back.png`;
  },
  get NEXT() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/chevron-forward.png`;
  },
  get CLOSE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/close.png`;
  },
};

const getUserKey = (user: SceneAdmin | SceneBanUser): string => {
  return 'address' in user ? user.address : user.bannedAddress;
};

const getUserAddress = (user: SceneAdmin | SceneBanUser): string => {
  return 'address' in user ? user.address : user.bannedAddress;
};

const canUserBeRemoved = (user: SceneAdmin | SceneBanUser): boolean => {
  return 'canBeRemoved' in user ? user.canBeRemoved !== false : true;
};

const getModalTitle = (type: UserListType) => {
  return type === UserListType.ADMIN ? '<b>ADMIN LIST</b>' : '<b>SCENE BAN LIST</b>';
};

const getCounterText = (type: UserListType, count: number) => {
  const itemType =
    type === UserListType.ADMIN
      ? count === 1
        ? 'admin'
        : 'admins'
      : count === 1
        ? 'user'
        : 'users';
  return `(${count} ${itemType})`;
};

const getActionButtonText = (type: UserListType) => {
  return type === UserListType.ADMIN ? '<b>Remove</b>' : '<b>Unban</b>';
};

const closeModal = (type: UserListType) => {
  if (type === UserListType.ADMIN) {
    moderationControlState.showModalAdminList = false;
  } else {
    moderationControlState.showModalBanList = false;
  }
};

export function ModalUserList({ users, engine, type }: ModalUserListProps) {
  const [page, setPage] = ReactEcs.useState(1);
  const styles = getModalStyles();
  const backgrounds = getModalBackgrounds();
  const colors = getModalColors();

  const handleRemoveUser = async (user: SceneAdmin | SceneBanUser) => {
    if (type === UserListType.ADMIN) {
      moderationControlState.adminToRemove = user as SceneAdmin;
    } else {
      const bannedUser = user as SceneBanUser;

      const success = await handleUnbanUser(bannedUser.bannedAddress);
      if (success) {
        const username = bannedUser.name || bannedUser.bannedAddress;
        moderationControlState.unbanMessage = `${username} has been unbanned from your scene`;
      } else {
        moderationControlState.unbanMessage = 'We were unable to unban this user';
      }
    }
  };

  ReactEcs.useEffect(() => {
    if (moderationControlState.unbanMessage) {
      let counter = 0;
      const interval = setInterval(
        engine,
        () => {
          counter += 100;
          if (counter >= 3000) {
            moderationControlState.unbanMessage = null;
          }
        },
        100,
      );

      return () => clearInterval(engine, interval);
    }
  }, [moderationControlState.unbanMessage]);

  if (moderationControlState.adminToRemove) {
    return (
      <RemoveAdminConfirmation
        admin={moderationControlState.adminToRemove}
        engine={engine}
      />
    );
  }

  const startIndex = (page - 1) * USERS_PER_PAGE;
  const endIndex = Math.min(startIndex + USERS_PER_PAGE, users.length);
  const currentPageUsers = users.slice(startIndex, endIndex);
  return (
    <UiEntity uiTransform={styles.overlay}>
      <UiEntity
        uiTransform={styles.container}
        uiBackground={backgrounds.container}
      >
        <UiEntity uiTransform={styles.content}>
          <UiEntity uiTransform={styles.header}>
            <UiEntity
              uiTransform={styles.headerIcon}
              uiBackground={
                type === UserListType.BAN ? backgrounds.banIcon : backgrounds.headerIcon
              }
            />
            <Label
              value={getModalTitle(type)}
              fontSize={24}
              color={colors.white}
            />
            <Label
              value={getCounterText(type, users.length)}
              fontSize={16}
              color={colors.gray}
              uiTransform={styles.usersCount}
            />
            <Button
              id="close-modal"
              onlyIcon
              icon={ICONS.CLOSE}
              variant="secondary"
              fontSize={20}
              uiTransform={styles.closeButton}
              iconTransform={styles.closeIcon}
              onMouseDown={() => closeModal(type)}
            />
          </UiEntity>

          <UiEntity uiTransform={styles.listContainer}>
            {currentPageUsers.map((user, index) => (
              <UiEntity
                key={getUserKey(user)}
                uiTransform={styles.userItem}
              >
                <UiEntity
                  key={`${type}-${user.name || getUserAddress(user)}`}
                  uiTransform={styles.userRow}
                >
                  <UiEntity uiTransform={styles.userInfo}>
                    <UiEntity uiTransform={styles.personIconContainer}>
                      <UiEntity
                        uiTransform={styles.personIcon}
                        uiBackground={backgrounds.personIcon}
                      />
                    </UiEntity>

                    <UiEntity uiTransform={styles.userDetails}>
                      {user.name && (
                        <UiEntity uiTransform={styles.nameContainer}>
                          <Label
                            value={`<b>${user.name}</b>`}
                            fontSize={14}
                            color={colors.white}
                          />
                          {!user.name.includes('#') && (
                            <UiEntity
                              uiTransform={styles.verifiedIcon}
                              uiBackground={backgrounds.verifiedIcon}
                            />
                          )}
                          {'role' in user &&
                            (user.role === 'owner' || user.role === 'operator') && (
                              <UiEntity
                                uiTransform={styles.roleBadge}
                                uiBackground={backgrounds.roleBadge}
                              >
                                <Label
                                  value={`<b>${
                                    ('role' in user ? (user.role ?? '') : '')
                                      ?.charAt(0)
                                      .toUpperCase() + ('role' in user ? user.role?.slice(1) : '')
                                  }</b>`}
                                  fontSize={12}
                                  color={colors.black}
                                />
                              </UiEntity>
                            )}
                        </UiEntity>
                      )}
                      <Label
                        fontSize={user.name ? 12 : 14}
                        value={user.name ? getUserAddress(user) : getUserAddress(user)}
                        color={user.name ? colors.addressGray : colors.white}
                      />
                    </UiEntity>
                  </UiEntity>
                  {(canUserBeRemoved(user) || type === UserListType.BAN) && (
                    <Button
                      id={`${type}-action-${index}`}
                      value={getActionButtonText(type)}
                      variant="text"
                      fontSize={14}
                      color={colors.removeRed}
                      labelTransform={styles.removeButton}
                      onMouseDown={() => handleRemoveUser(user)}
                    />
                  )}
                </UiEntity>
                <UiEntity
                  uiTransform={styles.divider}
                  uiBackground={backgrounds.divider}
                />
              </UiEntity>
            ))}
          </UiEntity>
        </UiEntity>

        {users.length > USERS_PER_PAGE && (
          <UiEntity uiTransform={styles.pagination}>
            <Button
              id="prev"
              value="Prev"
              variant="secondary"
              disabled={page <= 1}
              fontSize={18}
              icon={ICONS.BACK}
              iconTransform={styles.prevIcon}
              iconBackground={{ color: getPaginationColor(page <= 1) }}
              color={getPaginationColor(page <= 1)}
              labelTransform={styles.prevLabel}
              uiTransform={styles.paginationButton}
              onMouseDown={() => setPage(page - 1)}
            />
            <Label
              value={`${page} / ${Math.ceil(users.length / USERS_PER_PAGE)}`}
              fontSize={14}
              color={colors.white}
            />
            <Button
              id="next"
              value="<b>Next</b>"
              variant="secondary"
              fontSize={18}
              iconRight={ICONS.NEXT}
              iconRightTransform={styles.nextIcon}
              labelTransform={styles.nextLabel}
              iconRightBackground={{
                color: getPaginationColor(page >= Math.ceil(users.length / USERS_PER_PAGE)),
              }}
              color={getPaginationColor(page >= Math.ceil(users.length / USERS_PER_PAGE))}
              disabled={page >= Math.ceil(users.length / USERS_PER_PAGE)}
              uiTransform={styles.paginationButton}
              onMouseDown={() => setPage(page + 1)}
            />
          </UiEntity>
        )}

        {type === UserListType.BAN && moderationControlState.unbanMessage && (
          <UiEntity uiTransform={styles.messageContainer}>
            <Label
              value={moderationControlState.unbanMessage}
              fontSize={14}
              color={Color4.White()}
              uiTransform={styles.messageLabel}
            />
          </UiEntity>
        )}
      </UiEntity>
    </UiEntity>
  );
}
