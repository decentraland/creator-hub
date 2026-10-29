import { useId, useState, type ReactNode } from 'react';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import WarningIcon from '@mui/icons-material/WarningAmber';

import { t } from '/@/modules/store/translation/utils';

import { DialogButton } from '../../../DialogButton';
import { InfoIcon } from '../../../Icons';
import { TitleBarModal } from '../../../Modals/TitleBarModal';
import { FormTextInput } from '../../../TextInput';
import {
  Actions,
  ErrorBlock,
  EyeButton,
  Field,
  FieldLabel,
  Footer,
  Info,
  Mismatch,
} from './PasswordModal.styled';

const MIN_LENGTH = 8;
const MIN_NUMBERS = 2;

type Props = {
  open: boolean;
  mode: 'create' | 'change';
  onCancel: () => void;
  onConfirm: (password: string) => void;
};

type FieldProps = {
  label: string;
  value: string;
  error: ReactNode;
  autoFocus?: boolean;
  onChange: (value: string) => void;
};

function PasswordField({ label, value, error, autoFocus, onChange }: FieldProps) {
  const inputId = useId();
  const errorId = useId();
  const [shown, setShown] = useState(false);
  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <FormTextInput
        id={inputId}
        type={shown ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        error={!!error}
        onChange={event => onChange(event.target.value)}
        inputProps={{ 'aria-describedby': error ? errorId : undefined, 'aria-invalid': !!error }}
        endAdornment={
          <EyeButton
            disableRipple
            aria-label={t(
              shown ? 'world_detail.settings.password.hide' : 'world_detail.settings.password.show',
            )}
            onClick={() => setShown(current => !current)}
          >
            {shown ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </EyeButton>
        }
      />
      {error && (
        <ErrorBlock
          id={errorId}
          role="alert"
        >
          {error}
        </ErrorBlock>
      )}
    </Field>
  );
}

/** Creates or changes a World's access password: 8+ characters with 2+ numbers, typed twice. */
export function PasswordModal({ open, mode, onCancel, onConfirm }: Props) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const longEnough = password.length >= MIN_LENGTH;
  const enoughNumbers = (password.match(/\d/g) ?? []).length >= MIN_NUMBERS;
  const mismatch = !!password && !!repeat && password !== repeat;
  const valid = longEnough && enoughNumbers && password === repeat;

  const rulesError = password && (!longEnough || !enoughNumbers) && (
    <>
      <span>{t('world_detail.settings.password.requirements')}</span>
      <ul>
        {!longEnough && <li>{t('world_detail.settings.password.min_length')}</li>}
        {!enoughNumbers && <li>{t('world_detail.settings.password.min_numbers')}</li>}
      </ul>
    </>
  );

  return (
    <TitleBarModal
      open={open}
      title={t(
        mode === 'create'
          ? 'modal.world_permissions.password.dialog.create_title'
          : 'modal.world_permissions.password.dialog.change_title',
      )}
      onClose={onCancel}
    >
      <PasswordField
        label={t('modal.world_permissions.password.dialog.type_password')}
        value={password}
        error={rulesError}
        autoFocus
        onChange={setPassword}
      />
      <PasswordField
        label={t('modal.world_permissions.password.dialog.repeat_password')}
        value={repeat}
        error={
          mismatch && (
            <Mismatch>
              <WarningIcon />
              {t('world_detail.settings.password.mismatch')}
            </Mismatch>
          )
        }
        onChange={setRepeat}
      />
      <Footer>
        <Info>
          <InfoIcon />
          {t('modal.world_permissions.password.dialog.info')}
        </Info>
        <Actions>
          <DialogButton
            type="button"
            tone="secondary"
            onClick={onCancel}
          >
            {t('modal.cancel')}
          </DialogButton>
          <DialogButton
            type="button"
            tone="primary"
            disabled={!valid}
            onClick={() => onConfirm(password)}
          >
            {t('modal.confirm')}
          </DialogButton>
        </Actions>
      </Footer>
    </TitleBarModal>
  );
}
