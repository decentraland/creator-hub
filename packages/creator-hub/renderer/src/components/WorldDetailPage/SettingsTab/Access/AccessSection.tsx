import { useEffect, useRef, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import { MenuItem } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { WorldPermissionType } from '/@/lib/worlds';
import { fetchWorldPermissions } from '/@/modules/store/management/slice';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../../Button';
import { menuSurfaceStyles } from '../../../Dropdown/component.styled';
import { ChevronDownIcon } from '../../../Icons';
import { FieldTitle } from '../../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { selectRowStyles } from '../../../ManagePage/ViewBar/ViewBar.styled';
import { DefaultModal } from '../../../Modals/DefaultModal';
import { CheckSlot } from '../../DetailsTab/DetailsTab.styled';
import { AccessSelect, Block, Section, TypeDescription, TypeLabel } from './Access.styled';
import { InvitedList } from './InvitedList';
import { InviteForm } from './InviteForm';
import { PasswordModal } from './PasswordModal';
import { useAccessActions } from './useAccessActions';

const MENU_GAP = 10;

const TYPES: Record<
  | WorldPermissionType.Unrestricted
  | WorldPermissionType.AllowList
  | WorldPermissionType.SharedSecret,
  { label: TranslationPath; description: TranslationPath }
> = {
  [WorldPermissionType.Unrestricted]: {
    label: 'world_detail.settings.access.public',
    description: 'world_detail.settings.access.public_description',
  },
  [WorldPermissionType.AllowList]: {
    label: 'world_detail.settings.access.invitation_only',
    description: 'world_detail.settings.access.invitation_only_description',
  },
  [WorldPermissionType.SharedSecret]: {
    label: 'world_detail.settings.access.password_protected',
    description: 'world_detail.settings.access.password_protected_description',
  },
};

type AccessType = keyof typeof TYPES;

const typeText = (type: AccessType) => (
  <>
    <TypeLabel>{`${t(TYPES[type].label)}  `}</TypeLabel>
    <TypeDescription>{t(TYPES[type].description)}</TypeDescription>
  </>
);

/** The World's Access: Public, Invitation Only (edited inline) or Password Protected; every change is written at once. */
export function AccessSection({ worldName }: { worldName: string }) {
  const dispatch = useDispatch();
  const permissions = useSelector(state => state.management.worldPermissions);
  const [pending, setPending] = useState<AccessType | null>(null);
  const [password, setPassword] = useState<'create' | 'change' | null>(null);
  const [writing, setWriting] = useState(false);
  const writingRef = useRef(false);

  useEffect(() => {
    void dispatch(fetchWorldPermissions({ worldName }));
  }, [dispatch, worldName]);

  const loaded = permissions.worldName === worldName && permissions.permissions;
  const access = loaded ? permissions.permissions?.access : undefined;
  const actions = useAccessActions(worldName, access);
  if (!access) return null;

  const write = (action: () => Promise<unknown> | undefined): Promise<boolean> => {
    if (writingRef.current) return Promise.resolve(false);
    writingRef.current = true;
    const result = action();
    if (!result) {
      writingRef.current = false;
      return Promise.resolve(true);
    }
    setWriting(true);
    return result
      .then(
        () => true,
        () => false,
      )
      .finally(() => {
        writingRef.current = false;
        setWriting(false);
      });
  };

  const current = access.type as AccessType;
  const owner = permissions.owner.toLowerCase();
  const collaborators = Object.keys(permissions.summary ?? {}).map(address =>
    address.toLowerCase(),
  );
  const invitedWallets =
    access.type === WorldPermissionType.AllowList
      ? access.wallets.filter(
          wallet => wallet.toLowerCase() !== owner && !collaborators.includes(wallet.toLowerCase()),
        )
      : [];
  const invitedCommunities =
    access.type === WorldPermissionType.AllowList ? (access.communities ?? []) : [];
  const erasesSomething =
    (current === WorldPermissionType.AllowList &&
      invitedWallets.length + invitedCommunities.length > 0) ||
    current === WorldPermissionType.SharedSecret;

  const apply = (type: AccessType) => {
    if (type === WorldPermissionType.SharedSecret) {
      setPending(type);
      setPassword('create');
      return;
    }
    setPending(null);
    write(() => actions.changeType(type));
  };

  const pick = (type: AccessType) => {
    if (type === current || writingRef.current) return;
    if (erasesSomething) setPending(type);
    else apply(type);
  };

  const shown = pending && (password || !erasesSomething) ? pending : current;

  return (
    <Section>
      <Block>
        <FieldTitle as="span">{t('world_detail.settings.access.label')}</FieldTitle>
        <AccessSelect
          value={shown}
          disabled={writing}
          IconComponent={ChevronDownIcon}
          inputProps={{ 'aria-label': t('world_detail.settings.access.label') }}
          renderValue={value => typeText(value as AccessType)}
          onChange={event => pick(event.target.value as AccessType)}
          MenuProps={{
            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: { vertical: 'top', horizontal: 'left' },
            slotProps: { paper: { sx: { marginTop: `${MENU_GAP}px`, width: 700 } } },
            sx: [theme => menuSurfaceStyles({ theme }), theme => selectRowStyles({ theme })],
          }}
        >
          {(Object.keys(TYPES) as AccessType[]).map(type => (
            <MenuItem
              key={type}
              value={type}
            >
              <CheckSlot className="MenuGlyph">
                {type === shown && <CheckIcon aria-hidden />}
              </CheckSlot>
              <span>{typeText(type)}</span>
            </MenuItem>
          ))}
        </AccessSelect>
      </Block>
      {current === WorldPermissionType.AllowList && (
        <>
          <InviteForm
            disabled={writing}
            onAddWallet={address => write(() => actions.addWallet(address))}
            onAddCommunity={id => write(() => actions.addCommunity(id))}
            onAddCsv={data => write(() => actions.addCsv(data))}
          />
          <InvitedList
            wallets={invitedWallets}
            communities={invitedCommunities}
            disabled={writing}
            onRemove={removed => write(() => actions.remove(removed))}
          />
        </>
      )}
      {current === WorldPermissionType.SharedSecret && (
        <span className="ChangePassword">
          <Button
            variant="contained"
            color="primary"
            onClick={() => setPassword('change')}
          >
            {t('world_detail.settings.password.change_password')}
          </Button>
        </span>
      )}
      <DefaultModal
        open={!!pending && erasesSomething && !password}
        title={t('world_detail.settings.access.change_type_title')}
        body={t('world_detail.settings.access.change_type_warning')}
        onClose={() => setPending(null)}
        secondary={{ label: t('modal.cancel'), onClick: () => setPending(null) }}
        primary={{
          label: t('world_detail.settings.access.continue'),
          state: 'idle',
          onClick: () => pending && apply(pending),
        }}
      />
      {password && (
        <PasswordModal
          open
          mode={password}
          onCancel={() => {
            setPassword(null);
            setPending(null);
          }}
          onConfirm={secret =>
            void write(() => actions.setPassword(secret)).then(done => {
              if (!done) return;
              setPassword(null);
              setPending(null);
            })
          }
        />
      )}
    </Section>
  );
}
