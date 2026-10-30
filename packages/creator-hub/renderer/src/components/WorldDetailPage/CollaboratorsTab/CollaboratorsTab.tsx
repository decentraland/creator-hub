import { useId, useState } from 'react';
import { MenuItem } from 'decentraland-ui2';

import { useSnackbar } from '/@/hooks/useSnackbar';
import { MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';
import { t } from '/@/modules/store/translation/utils';

import { menuSurfaceStyles } from '../../Dropdown/component.styled';
import { ChevronDownIcon } from '../../Icons';
import { AccessRow } from '../../LandDetailPage/access/AccessRow';
import { AddRecipient } from '../../LandDetailPage/access/AddRecipient';
import { BulkTrash } from '../../LandDetailPage/access/BulkTrash';
import {
  AddBlock,
  ListHeader,
  ParcelSelect,
  Root,
  Rows,
} from '../../LandDetailPage/access/access.styled';
import { useDisplayName } from '../../LandDetailPage/access/useDisplayName';
import { SelectCheckbox } from '../../LandDetailPage/SelectCheckbox';
import { EmptyState } from '../../ManagePage/EmptyState';
import { selectRowStyles } from '../../ManagePage/ViewBar/ViewBar.styled';
import { DefaultModal } from '../../Modals/DefaultModal';
import { ParcelPickerModal } from '../../ParcelPicker';
import { StreamNote, WorldDescription, WorldListBlock } from './CollaboratorsTab.styled';
import { useWorldCollaborators } from './useWorldCollaborators';
import { MAX_COLLABORATORS, removalKind, type WorldCollaborator } from './worldCollaborators';

const ALL = 'all';
const SOME = 'some';
const NONE = 'none';
const CUSTOM = 'custom';
const WORLD_BOUNDS = {
  min: { x: MIN_COORDINATE, y: MIN_COORDINATE },
  max: { x: MAX_COORDINATE, y: MAX_COORDINATE },
};

type Picking = { row: WorldCollaborator; initial: Set<string> };

/** The World's collaborators: who may deploy (everywhere, on some parcels or nowhere) and stream, changed off-chain. */
export function CollaboratorsTab({ worldName }: { worldName: string }) {
  const world = useWorldCollaborators(worldName);
  const displayName = useDisplayName();
  const { pushGeneric } = useSnackbar();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<WorldCollaborator[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
  const { collaborators } = world;
  const noteId = useId();

  if (!world.loaded) return null;

  const run = (action: Promise<unknown>) => void action.catch(() => undefined);
  const selectedRows = collaborators.filter(row => selected.has(row.address));
  const all = selectedRows.length === collaborators.length;

  const toggle = (address: string) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await world.remove(removing);
      setSelected(new Set());
      setRemoving(null);
    } catch {
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  const changeDeploy = (row: WorldCollaborator, value: string) => {
    if (value === ALL && row.deploy.kind !== 'all') run(world.deployEverywhere(row.address));
    if (value === NONE && row.deploy.kind !== 'none') {
      if (row.stream) run(world.deployNowhere(row.address));
      else setRemoving([row]);
    }
    if (value === CUSTOM)
      run(world.parcelsOf(row.address).then(initial => setPicking({ row, initial })));
  };

  const changeStream = (row: WorldCollaborator) => {
    if (row.stream && row.deploy.kind === 'none') setRemoving([row]);
    else run(world.setStream(row.address, !row.stream));
  };

  const savePicked = (chosen: string[]) => {
    if (!picking) return;
    const { row, initial } = picking;
    setPicking(null);
    run(
      world
        .setParcels(row.address, chosen, initial)
        .then(() => pushGeneric('success', t('tx.done.parcels_updated'))),
    );
  };

  const removeTitle = (rows: WorldCollaborator[]) => {
    const kind = removalKind(rows.length, collaborators.length);
    if (kind === 'one')
      return t('world_detail.collaborators.remove_one_title', {
        name: displayName(rows[0].address),
      });
    return t(
      kind === 'all'
        ? 'world_detail.collaborators.remove_all_title'
        : 'world_detail.collaborators.remove_several_title',
    );
  };

  return (
    <Root>
      <AddBlock>
        <WorldDescription>{t('world_detail.collaborators.description')}</WorldDescription>
        {world.streamOpen && (
          <StreamNote id={noteId}>{t('world_detail.collaborators.stream_open')}</StreamNote>
        )}
        <AddRecipient
          onAdd={recipient => run(world.add(recipient.address))}
          notice={
            collaborators.length >= MAX_COLLABORATORS
              ? t('world_detail.collaborators.full')
              : undefined
          }
        />
      </AddBlock>
      {collaborators.length ? (
        <WorldListBlock>
          <ListHeader>
            <span className="Lead">
              <SelectCheckbox
                checked={all}
                indeterminate={selectedRows.length > 0 && !all}
                onChange={() =>
                  setSelected(all ? new Set() : new Set(collaborators.map(row => row.address)))
                }
                inputProps={{ 'aria-label': t('land_detail.collaborators.select_all') }}
              />
              {selectedRows.length ? (
                <>
                  <span
                    className="Selected"
                    role="status"
                  >
                    {t('land_detail.collaborators.selected', { count: selectedRows.length })}
                  </span>
                  <BulkTrash onClick={() => setRemoving(selectedRows)} />
                </>
              ) : (
                <span>
                  {t('world_detail.collaborators.count', { count: collaborators.length })}
                </span>
              )}
            </span>
            <span>{t('land_detail.collaborators.permissions_column')}</span>
            <span className="StreamHeader">{t('world_detail.collaborators.stream')}</span>
          </ListHeader>
          <Rows>
            {collaborators.map(row => {
              const name = displayName(row.address);
              const value = row.deploy.kind === 'parcels' ? SOME : row.deploy.kind;
              return (
                <AccessRow
                  key={row.address}
                  address={row.address}
                  onRemove={() => setRemoving([row])}
                  select={
                    <SelectCheckbox
                      checked={selected.has(row.address)}
                      onChange={() => toggle(row.address)}
                      inputProps={{ 'aria-label': t('land_detail.collaborators.select', { name }) }}
                    />
                  }
                  scope={
                    <ParcelSelect
                      value={value}
                      IconComponent={ChevronDownIcon}
                      inputProps={{
                        'aria-label': t('land_detail.collaborators.parcels_label', { name }),
                      }}
                      onChange={event => changeDeploy(row, String(event.target.value))}
                      MenuProps={{
                        sx: [
                          theme => menuSurfaceStyles({ theme }),
                          theme => selectRowStyles({ theme }),
                        ],
                      }}
                    >
                      <MenuItem value={ALL}>{t('land_detail.collaborators.all_parcels')}</MenuItem>
                      {row.deploy.kind === 'parcels' && (
                        <MenuItem value={SOME}>
                          {t('land_detail.collaborators.n_parcels', { count: row.deploy.count })}
                        </MenuItem>
                      )}
                      <MenuItem value={NONE}>{t('world_detail.collaborators.none')}</MenuItem>
                      <MenuItem value={CUSTOM}>
                        {t('land_detail.collaborators.custom_parcels')}
                      </MenuItem>
                    </ParcelSelect>
                  }
                  note={
                    <SelectCheckbox
                      checked={world.streamOpen || row.stream}
                      disabled={world.streamOpen}
                      onChange={() => changeStream(row)}
                      inputProps={{
                        'aria-label': t('world_detail.collaborators.stream_label', { name }),
                        'aria-describedby': world.streamOpen ? noteId : undefined,
                      }}
                    />
                  }
                />
              );
            })}
          </Rows>
        </WorldListBlock>
      ) : (
        <EmptyState
          title={t('land_detail.collaborators.empty')}
          description={t('world_detail.collaborators.description')}
        />
      )}
      {picking && (
        <ParcelPickerModal
          open
          name={displayName(picking.row.address)}
          walletAddress={picking.row.address}
          scenes={world.scenes}
          initialParcels={picking.initial}
          allowed={WORLD_BOUNDS}
          onCancel={() => setPicking(null)}
          onConfirm={savePicked}
        />
      )}
      <DefaultModal
        open={!!removing}
        title={removing ? removeTitle(removing) : ''}
        body={t('world_detail.collaborators.remove_body')}
        onClose={() => setRemoving(null)}
        secondary={{ label: t('modal.cancel'), onClick: () => setRemoving(null) }}
        primary={{
          label: t('land_detail.collaborators.remove_confirm'),
          state: busy ? 'busy' : 'idle',
          onClick: () => void confirmRemove(),
        }}
      />
    </Root>
  );
}
