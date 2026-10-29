import { useCallback, useId, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLandTxFlow } from '/@/hooks/useLandTxFlow';
import type { Land } from '/@/lib/land';
import { buildUpdateLandMetadata } from '/@/lib/landTransactions';
import type { AppState } from '/@/modules/store';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import { Button } from '../../Button';
import { DefaultModal } from '../../Modals/DefaultModal';
import { TxState, txCorner } from '../../Modals/TxState';
import { FormTextInput } from '../../TextInput';
import { DESCRIPTION_MAX, NAME_MAX, validateDetails, type FieldError } from './details';
import { DomainName } from './DomainName';
import {
  Counter,
  DescriptionInput,
  EmptyValue,
  ErrorText,
  Field,
  FieldTitle,
  Help,
  InputSlot,
  ReadOnly,
  Root,
} from './DetailsTab.styled';

type Props = {
  land: Land;
  project: ManagedProject;
  mode: 'edit' | 'read';
  actionsSlot: HTMLElement | null;
};

const INPUT = { single: FormTextInput, multi: DescriptionInput };

type TextFieldProps = {
  label: string;
  value: string;
  max: number;
  error: FieldError;
  placeholder: string;
  multiline: 'single' | 'multi';
  onChange: (value: string) => void;
};

function DetailsField({
  label,
  value,
  max,
  error,
  placeholder,
  multiline,
  onChange,
}: TextFieldProps) {
  const inputId = useId();
  const helpId = useId();
  const Input = INPUT[multiline];
  return (
    <Field>
      <FieldTitle htmlFor={inputId}>{label}</FieldTitle>
      <InputSlot>
        <Input
          id={inputId}
          value={value}
          placeholder={placeholder}
          multiline={multiline === 'multi'}
          error={!!error}
          onChange={event => onChange(event.target.value)}
          inputProps={{ 'aria-describedby': helpId, 'aria-invalid': !!error }}
        />
        <Help id={helpId}>
          {error && <ErrorText>{t(error.key, { max: error.max })}</ErrorText>}
          <Counter over={value.length > max ? 'over' : 'within'}>
            {t('land_detail.details.counter', { count: value.length, max })}
          </Counter>
        </Help>
      </InputSlot>
    </Field>
  );
}

/** The LAND's name and description, saved together on-chain, and its Domain Name. */
export function DetailsTab({ land, project, mode, actionsSlot }: Props) {
  const saved = { name: land.name, description: land.description ?? '' };
  const [name, setName] = useState(saved.name);
  const [description, setDescription] = useState(saved.description);
  const [confirming, setConfirming] = useState(false);
  const errors = validateDetails(name, description);
  const dirty = name !== saved.name || description !== saved.description;
  const valid = !errors.name && !errors.description;

  const isApplied = useCallback(
    (state: AppState) => {
      const current = state.land.data.find(item => item.id === land.id);
      return current?.name === name && (current.description ?? '') === description;
    },
    [land.id, name, description],
  );
  const { flow, start, retry, reset } = useLandTxFlow({ isApplied });

  const discard = () => {
    setName(saved.name);
    setDescription(saved.description);
  };
  const closeConfirm = () => {
    setConfirming(false);
    reset();
  };

  if (mode === 'read') {
    return (
      <Root>
        <ReadOnly>
          <dt>{t('land_detail.details.name')}</dt>
          <dd>{land.name || <EmptyValue>—</EmptyValue>}</dd>
          <dt>{t('land_detail.details.description')}</dt>
          <dd>{land.description || <EmptyValue>—</EmptyValue>}</dd>
        </ReadOnly>
        <DomainName
          land={land}
          project={project}
        />
      </Root>
    );
  }

  return (
    <Root>
      {actionsSlot &&
        createPortal(
          <>
            {dirty && (
              <Button
                variant="contained"
                color="secondary"
                onClick={discard}
              >
                {t('land_detail.discard')}
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              disabled={!dirty || !valid}
              onClick={() => setConfirming(true)}
            >
              {t('land_detail.save')}
            </Button>
          </>,
          actionsSlot,
        )}
      <DetailsField
        label={t('land_detail.details.name')}
        value={name}
        max={NAME_MAX}
        error={dirty ? errors.name : null}
        placeholder={t('land_detail.details.name_placeholder')}
        multiline="single"
        onChange={setName}
      />
      <DetailsField
        label={t('land_detail.details.description')}
        value={description}
        max={DESCRIPTION_MAX}
        error={errors.description}
        placeholder={t('land_detail.details.description_placeholder')}
        multiline="multi"
        onChange={setDescription}
      />
      <DomainName
        land={land}
        project={project}
      />
      <DefaultModal
        corner={txCorner(flow)}
        open={confirming}
        title={t('land_detail.details.save_title')}
        onClose={closeConfirm}
        body={flow ? undefined : t('land_detail.details.save_body')}
        secondary={flow ? undefined : { label: t('modal.cancel'), onClick: closeConfirm }}
        primary={
          flow
            ? undefined
            : {
                label: t('land_detail.save'),
                state: 'idle',
                onClick: () => void start([buildUpdateLandMetadata(land, name, description)]),
              }
        }
      >
        {flow && (
          <TxState
            flow={flow}
            doneText={t('tx.done.details')}
            onRetry={() => void retry()}
            onClose={closeConfirm}
          />
        )}
      </DefaultModal>
    </Root>
  );
}
