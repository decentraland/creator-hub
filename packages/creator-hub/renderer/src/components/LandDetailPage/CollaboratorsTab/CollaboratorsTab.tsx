import { useState } from 'react';
import { MenuItem } from 'decentraland-ui2';

import type { Land } from '/@/lib/land';
import { LandType } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';

import { SelectCheckbox } from '../SelectCheckbox';
import { Button } from '../../Button';
import { menuSurfaceStyles } from '../../Dropdown/component.styled';
import { ChevronDownIcon } from '../../Icons';
import { EmptyState } from '../../ManagePage/EmptyState';
import { selectRowStyles } from '../../ManagePage/ViewBar/ViewBar.styled';
import { ParcelPicker } from '../../ParcelPicker';
import { AccessChangeModal, landIn, type AccessRequest } from '../access/AccessChangeModal';
import { AccessRow } from '../access/AccessRow';
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

  const rowKey = (row: Collaborator) => `${row.address}-${row.scope.kind}`;
  const selectedRows = collaborators.filter(row => selected.has(rowKey(row)));

  if (picking && picking.scope.kind === 'parcels') {
    const previous = picking.scope.parcels;
    return (
      <ParcelPicker
        walletAddress={picking.address}
        scenes={[{ parcels: (land.parcels ?? []).map(parcel => parcel.id) }]}
        initialParcels={new Set(previous.map(coordKey))}
        allowed={new Set((land.parcels ?? []).map(parcel => parcel.id))}
        title={t('land_detail.collaborators.parcels_title')}
        description={t('land_detail.collaborators.description')}
        saving={false}
        onGoBack={() => setPicking(null)}
        onConfirm={parcels => {
          const chosen = parcels.map(id => {
            const [x, y] = id.split(',').map(Number);
            return { x, y };
          });
          setPicking(null);
          ask(
            { kind: 'parcels', address: picking.address, parcels: chosen, previous },
            {
              title: t('land_detail.collaborators.parcels_title'),
              body: t('land_detail.collaborators.parcels_body', {
                name: displayName(picking.address),
                count: chosen.length,
                b: bold,
              }),
              confirmLabel: t('modal.confirm'),
            },
          );
        }}
      />
    );
  }

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
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    onClick={() => remove(selectedRows)}
                  >
                    {t('land_detail.collaborators.remove_selected')}
                  </Button>
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
      {request && (
        <AccessChangeModal
          request={request}
          onClose={() => {
            setRequest(null);
            setSelected(new Set());
          }}
        />
      )}
    </Root>
  );
}
