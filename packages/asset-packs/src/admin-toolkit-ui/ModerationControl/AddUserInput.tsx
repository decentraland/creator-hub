// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { UiEntity, Label, Input } from '@dcl/react-ecs';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { FieldLabel } from '../Primitives';
import { PillButton } from '../Controls';
import { handleAddAdmin, handleBanUser } from './utils';
import type { SceneAdmin } from '.';

export enum PermissionType {
  ADMIN = 'admin',
  BAN = 'ban',
}

type Props = {
  type: PermissionType;
  sceneAdmins: SceneAdmin[];
};

function isValidAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

// Names can have 15 characters max; longer values are treated as addresses.
function isAddress(value: string) {
  return value.length > 15;
}

export function AddUserInput({ type, sceneAdmins }: Props) {
  const [error, setError] = ReactEcs.useState('');
  const [loading, setLoading] = ReactEcs.useState(false);
  const [inputValue, setInputValue] = ReactEcs.useState('');
  const isAdminType = type === PermissionType.ADMIN;

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

    const clearInput = () => setInputValue('');

    if (isAdminType) {
      const adminData = isAddress(submitValue) ? { admin: submitValue } : { name: submitValue };
      await handleAddAdmin(adminData, setError, setLoading, clearInput);
    } else {
      if (isAdmin(submitValue)) {
        setError('Admin users cannot be banned. Remove them from the Admin list first.');
        return;
      }
      const banData = isAddress(submitValue)
        ? { banned_address: submitValue }
        : { banned_name: submitValue };
      await handleBanUser(banData, setError, setLoading, clearInput);
    }
  };

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <FieldLabel text={isAdminType ? 'Add an admin' : 'Ban a user'} />
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <Input
          onChange={value => {
            setError('');
            setInputValue(value);
          }}
          value={inputValue}
          fontSize={TYPE.body}
          placeholder="Name or wallet address"
          placeholderColor={COLORS.inputPlaceholder}
          color={COLORS.inputText}
          uiBackground={{ color: COLORS.inputBackground }}
          uiTransform={{
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            height: 40,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: error ? COLORS.danger : COLORS.inputBorder,
            margin: { right: SPACING.md },
          }}
        />
        <PillButton
          id={isAdminType ? 'moderation_control_add_admin' : 'moderation_control_ban_user'}
          label={isAdminType ? 'Add' : 'Ban'}
          iconName={isAdminType ? 'plus' : 'ban'}
          variant="filled"
          uiTransform={{ flexShrink: 0 }}
          onClick={handleSubmit}
        />
      </UiEntity>
      {error && (
        <Label
          value={error}
          fontSize={TYPE.small}
          color={COLORS.danger}
          uiTransform={{ margin: { top: SPACING.sm }, maxWidth: '100%' }}
        />
      )}
    </UiEntity>
  );
}
