import { useMemo, useState } from 'react';
import { MenuItem } from 'decentraland-ui2';

import type { Land } from '/@/lib/land';
import { LandType } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';

import { SelectCheckbox } from '../SelectCheckbox';
import { menuSurfaceStyles } from '../../Dropdown/component.styled';
import { ChevronDownIcon } from '../../Icons';
import { EmptyState } from '../../ManagePage/EmptyState';
import { selectRowStyles } from '../../ManagePage/ViewBar/ViewBar.styled';
import { ParcelPickerModal } from '../../ParcelPicker';
import {
  AccessChangeModal,
  landIn,
  useAccessChange,
  type AccessRequest,
} from '../access/AccessChangeModal';
import { AccessRow } from '../access/AccessRow';
import { BulkTrash } from '../access/BulkTrash';
import { AddRecipient } from '../access/AddRecipient';
import {
  AddBlock,
  Description,
  ListBlock,
  ListHeader,
  ParcelSelect,
  Root,
  Rows,
} from '../access/access.styled';
import { useDisplayName } from '../access/useDisplayName';
import { getCollaborators, type Collaborator, type Coord } from './collaborators';
import { planCollaboratorChange, type CollaboratorChange } from './plan';

const ALL = 'all';
const CUSTOM = 'custom';
const bold = (chunks: string) => <b>{chunks}</b>;
const coordKey = ({ x, y }: Coord) => `${x},${y}`;

type Props = { land: Land; landName: string };

type PickParcelsProps = {
  land: Land;
  collaborator: Collaborator;
  name: string;
  request: AccessRequest | null;
  onConfirm: (parcels: Coord[]) => void;
  onClose: () => void;
};

function PickParcels({ land, collaborator, name, request, onConfirm, onClose }: PickParcelsProps) {
  const next = useAccessChange(request, onClose);
  const estateParcels = useMemo(() => (land.parcels ?? []).map(parcel => parcel.id), [land]);
  const scenes = useMemo(() => [{ parcels: estateParcels }], [estateParcels]);
  const allowed = useMemo(() => new Set(estateParcels), [estateParcels]);
  const initialParcels = useMemo(
    () =>
      new Set(
        collaborator.scope.kind === 'parcels' ? collaborator.scope.parcels.map(coordKey) : [],
      ),
    [collaborator],
  );

  return (
    <ParcelPickerModal
      open
      name={name}
      walletAddress={collaborator.address}
      scenes={scenes}
      initialParcels={initialParcels}
      allowed={allowed}
      onCancel={onClose}
      onConfirm={parcels =>
        onConfirm(
          parcels.map(id => {
            const [x, y] = id.split(',').map(Number);
            return { x, y };
          }),
        )
      }
      next={next}
    />
  );
}

/** The LAND's per-token update operators: add, replace, remove and, on estates, per-parcel scopes. */
export function CollaboratorsTab({ land, landName }: Props) {
  const collaborators = getCollaborators(land);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [picking, setPicking] = useState<Collaborator | null>(null);
  const isEstate = land.type === LandType.ESTATE;
  const displayName = useDisplayName();

  const ask = (
    change: CollaboratorChange,
    copy: { title: string; body: AccessRequest['body']; confirmLabel: string },
  ) => {
    const plan = planCollaboratorChange(land, change);
    setRequest({
      ...copy,
      doneText: t(plan.doneKey),
      txs: plan.txs,
      isApplied: state => {
        const next = landIn(state, land.id);
        return !!next && plan.isApplied(next);
      },
    });
  };

  const add = (address: string) => {
    const current = collaborators.find(row => row.scope.kind !== 'parcels');
    const display = displayName(address);
    if (current) {
      ask(
        { kind: 'add', address },
        {
          title: t('land_detail.collaborators.replace_title'),
          body: t('land_detail.collaborators.replace_body', {
            new: display,
            current: displayName(current.address),
            b: bold,
          }),
          confirmLabel: t('land_detail.collaborators.replace_confirm'),
        },
      );
      return;
    }
    ask(
      { kind: 'add', address },
      {
        title: t('land_detail.collaborators.add_title'),
        body: t('land_detail.collaborators.add_body', { name: display, land: landName, b: bold }),
        confirmLabel: t('land_detail.collaborators.add'),
      },
    );
  };

  const remove = (rows: Collaborator[]) =>
    ask(
      { kind: 'remove', collaborators: rows },
      {
        title:
          rows.length > 1
            ? t('land_detail.collaborators.remove_many_title', { count: rows.length })
            : t('land_detail.collaborators.remove_title', {
                name: displayName(rows[0].address),
              }),
        body: t('land_detail.collaborators.remove_body'),
        confirmLabel: t('land_detail.collaborators.remove_confirm'),
      },
    );

  const close = () => {
    setRequest(null);
    setPicking(null);
    setSelected(new Set());
  };

  const rowKey = (row: Collaborator) => `${row.address}-${row.scope.kind}`;
  const selectedRows = collaborators.filter(row => selected.has(rowKey(row)));

  return (
    <Root>
      <AddBlock>
        <Description>{t('land_detail.collaborators.description')}</Description>
        <AddRecipient onAdd={recipient => add(recipient.address)} />
      </AddBlock>
      {collaborators.length ? (
        <ListBlock>
          <ListHeader>
            <span className="Lead">
              <SelectCheckbox
                checked={selectedRows.length === collaborators.length}
                indeterminate={
                  selectedRows.length > 0 && selectedRows.length < collaborators.length
                }
                onChange={() =>
                  setSelected(
                    selectedRows.length === collaborators.length
                      ? new Set()
                      : new Set(collaborators.map(rowKey)),
                  )
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
                  <BulkTrash onClick={() => remove(selectedRows)} />
                </>
              ) : (
                <span>{t('land_detail.collaborators.count', { count: collaborators.length })}</span>
              )}
            </span>
            {isEstate && <span>{t('land_detail.collaborators.permissions_column')}</span>}
          </ListHeader>
          <Rows>
            {collaborators.map(row => {
              const name = displayName(row.address);
              const value = row.scope.kind === 'parcels' ? 'some' : ALL;
              return (
                <AccessRow
                  key={rowKey(row)}
                  address={row.address}
                  onRemove={() => remove([row])}
                  select={
                    <SelectCheckbox
                      checked={selected.has(rowKey(row))}
                      onChange={() =>
                        setSelected(current => {
                          const next = new Set(current);
                          if (next.has(rowKey(row))) next.delete(rowKey(row));
                          else next.add(rowKey(row));
                          return next;
                        })
                      }
                      inputProps={{ 'aria-label': t('land_detail.collaborators.select', { name }) }}
                    />
                  }
                  scope={
                    isEstate && (
                      <ParcelSelect
                        value={value}
                        IconComponent={ChevronDownIcon}
                        inputProps={{
                          'aria-label': t('land_detail.collaborators.parcels_label', { name }),
                        }}
                        renderValue={() =>
                          row.scope.kind === 'parcels'
                            ? t('land_detail.collaborators.n_parcels', {
                                count: row.scope.parcels.length,
                              })
                            : t('land_detail.collaborators.all_parcels')
                        }
                        onChange={event => {
                          if (event.target.value === CUSTOM) {
                            setPicking(
                              row.scope.kind === 'parcels'
                                ? row
                                : { address: row.address, scope: { kind: 'parcels', parcels: [] } },
                            );
                          } else if (event.target.value === ALL && row.scope.kind === 'parcels') {
                            add(row.address);
                          }
                        }}
                        MenuProps={{
                          sx: [
                            theme => menuSurfaceStyles({ theme }),
                            theme => selectRowStyles({ theme }),
                          ],
                        }}
                      >
                        <MenuItem value={ALL}>
                          {t('land_detail.collaborators.all_parcels')}
                        </MenuItem>
                        {row.scope.kind === 'parcels' && (
                          <MenuItem value="some">
                            {t('land_detail.collaborators.n_parcels', {
                              count: row.scope.parcels.length,
                            })}
                          </MenuItem>
                        )}
                        <MenuItem value={CUSTOM}>
                          {t('land_detail.collaborators.custom_parcels')}
                        </MenuItem>
                      </ParcelSelect>
                    )
                  }
                />
              );
            })}
          </Rows>
        </ListBlock>
      ) : (
        <EmptyState
          title={t('land_detail.collaborators.empty')}
          description={t('land_detail.collaborators.description')}
        />
      )}
      {picking && (
        <PickParcels
          land={land}
          collaborator={picking}
          name={displayName(picking.address)}
          request={request}
          onConfirm={chosen =>
            ask(
              {
                kind: 'parcels',
                address: picking.address,
                parcels: chosen,
                previous: picking.scope.kind === 'parcels' ? picking.scope.parcels : [],
              },
              {
                title: t('parcel_picker.title'),
                body: t('land_detail.collaborators.parcels_body', {
                  name: displayName(picking.address),
                  count: chosen.length,
                  b: bold,
                }),
                confirmLabel: t('modal.confirm'),
              },
            )
          }
          onClose={close}
        />
      )}
      {request && !picking && (
        <AccessChangeModal
          request={request}
          onClose={close}
        />
      )}
    </Root>
  );
}
