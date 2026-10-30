import { useCallback, useState } from 'react';

import { useLandTxFlow } from '/@/hooks/useLandTxFlow';
import type { Land } from '/@/lib/land';
import { buildUpdateLandMetadata } from '/@/lib/landTransactions';
import type { AppState } from '/@/modules/store';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import { useDraft } from '../../DetailShell';
import { DefaultModal } from '../../Modals/DefaultModal';
import { TxState, txCorner } from '../../Modals/TxState';
import { DESCRIPTION_MAX, NAME_MAX, validateDetails } from './details';
import { DetailsField } from './DetailsField';
import { DomainName } from './DomainName';
import { EmptyValue, ReadOnly, Root } from './DetailsTab.styled';

type Props = {
  land: Land;
  project: ManagedProject;
  mode: 'edit' | 'read';
};

/** The LAND's name and description, saved together on-chain, and its Domain Name. */
export function DetailsTab({ land, project, mode }: Props) {
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
  useDraft({ dirty, valid, onCancel: discard, onSave: () => setConfirming(true) });
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
