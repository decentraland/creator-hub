import { useCallback, useMemo, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { IconButton, MenuItem } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useLandTxFlow } from '/@/hooks/useLandTxFlow';
import type { Land } from '/@/lib/land';
import type { AppState } from '/@/modules/store';
import { fetchENSList } from '/@/modules/store/ens';
import { buildLinkName, encodeLandRedirect } from '/@/modules/store/ens/names';
import { getLandName } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import { menuSurfaceStyles } from '../../Dropdown/component.styled';
import { CLAIM_NAME_URL } from '../../ManagePage/manageEmptyState';
import { selectRowStyles } from '../../ManagePage/ViewBar/ViewBar.styled';
import { DefaultModal } from '../../Modals/DefaultModal';
import { TxState, txCorner } from '../../Modals/TxState';
import { ChevronDownIcon, EditIcon } from '../../Icons';
import { getDomainState, toLandIdByParcel } from './details';
import {
  ClaimLink,
  DomainHelp,
  DomainSelect,
  Field,
  FieldTitle,
  SetName,
} from './DetailsTab.styled';

const REMOVE = '__remove__';

type Change = { kind: 'set'; name: string } | { kind: 'remove'; name: string };

/** The Domain Name field: links one of the account's NAMEs to this LAND, or removes the link. */
export function DomainName({ land, project }: { land: Land; project: ManagedProject }) {
  const dispatch = useDispatch();
  const { wallet = '' } = useAuth();
  const names = useSelector(state => state.ens.data);
  const lands = useSelector(state => state.land.data);
  const worlds = useSelector(state => state.management.projects);
  const landProjects = useSelector(state => state.management.lands.projects);
  const [editing, setEditing] = useState(false);
  const [change, setChange] = useState<Change | null>(null);
  const hash = useRef<Hex | null>(null);
  const [steps, setSteps] = useState<string[] | undefined>(undefined);
  const landIdByParcel = useMemo(() => toLandIdByParcel(lands), [lands]);

  const domain = useMemo(
    () =>
      getDomainState(Object.values(names), {
        self: wallet,
        landId: land.id,
        landIdByParcel,
        publishedWorlds: new Set(worlds.filter(world => world.deployment).map(world => world.id)),
        landNameById: Object.fromEntries(landProjects.map(item => [item.id, getLandName(item)])),
      }),
    [names, wallet, land.id, landIdByParcel, worlds, landProjects],
  );

  const isApplied = useCallback(
    (state: AppState) =>
      !!change &&
      (state.ens.data[change.name]?.content ?? '').toLowerCase() ===
        (change.kind === 'set' ? (hash.current ?? '') : '0x').toLowerCase(),
    [change],
  );
  const refetch = useCallback(async () => {
    await dispatch(fetchENSList({ address: wallet }));
  }, [dispatch, wallet]);
  const { flow, start, retry, reset } = useLandTxFlow({ isApplied, refetch });

  const close = () => {
    setChange(null);
    setEditing(false);
    reset();
  };

  const confirm = async () => {
    const name = change && names[change.name];
    if (!change || !name) return;
    if (change.kind === 'remove') {
      await start(buildLinkName(name, '0x'));
      return;
    }
    const base = project.place?.kind === 'estate' ? project.place.base : { x: land.x!, y: land.y! };
    const content = encodeLandRedirect(base);
    const txs = buildLinkName(name, content);
    hash.current = content;
    setSteps(
      txs.length > 1
        ? [t('land_detail.details.domain_step_resolver'), t('land_detail.details.domain_step_link')]
        : undefined,
    );
    await start(txs);
  };

  const landName = getLandName(project);

  return (
    <Field>
      <FieldTitle as="span">{t('land_detail.details.domain')}</FieldTitle>
      <DomainHelp>{t('land_detail.details.domain_help')}</DomainHelp>
      {domain.kind === 'set' && !editing && (
        <SetName
          value={domain.name}
          readOnly
          inputProps={{ 'aria-label': t('land_detail.details.domain') }}
          endAdornment={
            <IconButton
              aria-label={t('land_detail.details.domain_change')}
              onClick={() => setEditing(true)}
            >
              <EditIcon />
            </IconButton>
          }
        />
      )}
      {domain.kind !== 'empty' && (domain.kind !== 'set' || editing) && (
        <DomainSelect
          value=""
          displayEmpty
          IconComponent={ChevronDownIcon}
          defaultOpen={editing}
          inputProps={{ 'aria-label': t('land_detail.details.domain') }}
          renderValue={() => t('land_detail.details.domain_placeholder')}
          onChange={event => {
            const value = String(event.target.value);
            if (value === REMOVE && domain.kind === 'set') {
              setChange({ kind: 'remove', name: domain.name });
            } else if (value) setChange({ kind: 'set', name: value });
          }}
          MenuProps={{
            sx: [theme => menuSurfaceStyles({ theme }), theme => selectRowStyles({ theme })],
          }}
        >
          {domain.kind === 'set' && (
            <MenuItem
              value={REMOVE}
              className="Danger"
            >
              {t('land_detail.details.domain_remove')}
            </MenuItem>
          )}
          {domain.options.map(option => (
            <MenuItem
              key={option.subdomain}
              value={option.subdomain}
              disabled={!!option.usedBy}
            >
              {option.subdomain}
              {option.usedBy &&
                ` · ${t('land_detail.details.domain_used', { target: option.usedBy })}`}
            </MenuItem>
          ))}
        </DomainSelect>
      )}
      {domain.kind !== 'set' && (
        <ClaimLink href={CLAIM_NAME_URL}>{t('land_detail.details.claim_name')}</ClaimLink>
      )}
      <DefaultModal
        corner={txCorner(flow)}
        open={!!change}
        title={t(
          change?.kind === 'remove'
            ? 'land_detail.details.domain_remove_title'
            : 'land_detail.details.domain_set_title',
        )}
        onClose={close}
        body={
          flow || !change
            ? undefined
            : t(
                change.kind === 'remove'
                  ? 'land_detail.details.domain_remove_body'
                  : 'land_detail.details.domain_set_body',
                { name: change.name, land: landName, b: (chunks: string) => <b>{chunks}</b> },
              )
        }
        secondary={flow ? undefined : { label: t('modal.cancel'), onClick: close }}
        primary={
          flow
            ? undefined
            : {
                label: t(
                  change?.kind === 'remove'
                    ? 'land_detail.details.domain_remove'
                    : 'land_detail.details.domain_set_title',
                ),
                state: 'idle',
                onClick: () => void confirm(),
              }
        }
      >
        {flow && (
          <TxState
            flow={flow}
            doneText={t(
              change?.kind === 'remove' ? 'tx.done.domain_removed' : 'tx.done.domain_set',
            )}
            stepLabels={steps}
            onRetry={() => void retry()}
            onClose={close}
          />
        )}
      </DefaultModal>
    </Field>
  );
}
