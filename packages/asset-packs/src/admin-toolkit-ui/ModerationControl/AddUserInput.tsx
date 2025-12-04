import ReactEcs, { UiEntity, Label, Input } from '@dcl/react-ecs';
import { Button } from '../Button';
import {
  getAddUserInputStyles,
  getAddUserInputColors,
  getAddUserInputBackgrounds,
} from './styles/AddUserInputStyles';
import { handleAddAdmin, handleBanUser } from './utils';
import { BanUserDescription } from './BanUserDescription';

import { SceneAdmin } from '.';

export enum PermissionType {
  ADMIN = 'admin',
  BAN = 'ban',
}

type Props = {
  scaleFactor: number;
  type: PermissionType;
  sceneAdmins: SceneAdmin[];
};

function isValidAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

//Names can have 15 characters max, if the characters exceeded that, we assume is an address
function isAddress(value: string) {
  return value.length > 15;
}

export function AddUserInput({ scaleFactor, type, sceneAdmins }: Props) {
  const [error, setError] = ReactEcs.useState('');
  const [loading, setLoading] = ReactEcs.useState(false);
  const [inputValue, setInputValue] = ReactEcs.useState('');
  const styles = getAddUserInputStyles(scaleFactor);
  const colors = getAddUserInputColors();
  const backgrounds = getAddUserInputBackgrounds();

  const isAdmin = (user: string) =>
    sceneAdmins.some(admin => admin.address === user || admin.name === user);

  const handleSubmit = async () => {
    if (loading) return;

    const submitValue = inputValue.trim();

    if (!submitValue || submitValue.length <= 2) {
      setError('Provide a valid address or NAME');
      return;
    }

    if (isAddress(submitValue) && !isValidAddress(submitValue)) {
      setError('Provide a valid address format');
      return;
    }

    const clearInput = () => {
      setInputValue('');
    };

    if (type === PermissionType.ADMIN) {
      const adminData = isAddress(submitValue) ? { admin: submitValue } : { name: submitValue };
      await handleAddAdmin(adminData, setError, setLoading, clearInput);
    } else {
      if (isAdmin(submitValue)) {
        setError(
          'Admin users cannot be banned. Please remove this user from the Admin List and try again.',
        );
        return;
      }
      const banData = isAddress(submitValue)
        ? { banned_address: submitValue }
        : { banned_name: submitValue };
      await handleBanUser(banData, setError, setLoading, clearInput);
    }
  };

  return (
    <UiEntity uiTransform={styles.container}>
      <Label
        value={type === PermissionType.ADMIN ? '<b>Add an Admin</b>' : '<b>Ban User from Scene</b>'}
        fontSize={18 * scaleFactor}
        color={colors.white}
        uiTransform={styles.title}
      />
      {type === PermissionType.BAN && <BanUserDescription scaleFactor={scaleFactor} />}
      <UiEntity>
        <Input
          onChange={value => {
            setError('');
            setInputValue(value);
          }}
          value={inputValue}
          fontSize={14 * scaleFactor}
          placeholder={'Enter a NAME or wallet address'}
          uiBackground={backgrounds.input}
          uiTransform={{
            ...styles.input,
            borderColor: error ? colors.red : colors.white,
          }}
        />
        <Button
          id={
            type === PermissionType.ADMIN
              ? 'moderation_control_add_admin'
              : 'moderation_control_ban_user'
          }
          value={type === PermissionType.ADMIN ? '<b>Add</b>' : '<b>Ban</b>'}
          fontSize={18 * scaleFactor}
          uiTransform={styles.button}
          color={type === PermissionType.BAN ? colors.white : undefined}
          onMouseDown={handleSubmit}
          uiBackground={{
            color: type === PermissionType.BAN ? colors.pink : undefined,
          }}
        />
      </UiEntity>

      {error && (
        <UiEntity uiTransform={styles.errorContainer}>
          <UiEntity
            uiTransform={styles.errorIcon}
            uiBackground={backgrounds.errorIcon}
          />
          <UiEntity
            uiText={{
              value: error,
              fontSize: 14 * scaleFactor,
              color: colors.red,
              textAlign: 'top-left',
            }}
          />
        </UiEntity>
      )}
    </UiEntity>
  );
}
