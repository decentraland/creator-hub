import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { misc, sceneExport } from '#preload';
import { useDispatch, useSelector } from '#store';
import { config } from '/@/config';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { Lands, type Land } from '/@/lib/land';
import { fetchLandDeployers } from '/@/modules/store/management/slice';
import { getLandName, toLandScenes, type LandScene } from '/@/modules/store/management/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';
import { SortBy, type ManagedProject } from '/shared/types/manage';
import type { SceneExportResult } from '/shared/types/scene-export';

import { SelectCheckbox } from '../SelectCheckbox';
import { Button } from '../../Button';
import { ArrowDownIcon, LayersIcon, LayoutOutlineIcon } from '../../Icons';
import { EmptyState } from '../../ManagePage/EmptyState';
import { SearchField, SelectField, SORT_OPTIONS } from '../../ManagePage/ViewBar';
import { DefaultModal } from '../../Modals/DefaultModal';
import { UnpublishSceneModal, type UnpublishTarget } from '../../Modals/UnpublishSceneModal';
import { SceneRow, type DownloadState, type RowMode } from './SceneRow';
import { selectScenes, slugify } from './scenes';
import { Bulk, Meta, Root, ScenesBar, Stats, Table } from './ScenesTab.styled';

const RESULT_MESSAGE: Record<
  SceneExportResult['recovered'],
  { severity: 'success' | 'warning'; key: TranslationPath }
> = {
  'self-contained': { severity: 'success', key: 'land_detail.download.done_self_contained' },
  partial: { severity: 'warning', key: 'land_detail.download.done_partial' },
  none: { severity: 'warning', key: 'land_detail.download.done_none' },
};

const IDLE: DownloadState = { kind: 'idle' };

type SortColumn = 'name' | 'updated';

const SORTED: Record<SortBy, { column: SortColumn; direction: 'ascending' | 'descending' }> = {
  [SortBy.LATEST]: { column: 'updated', direction: 'descending' },
  [SortBy.NAME]: { column: 'name', direction: 'ascending' },
};

type Props = { land: Land; project: ManagedProject; mode: RowMode };

/** The scenes deployed on a LAND: sort, search, download and unpublish. */
export function ScenesTab({ land, project, mode }: Props) {
  const navigate = useNavigate();
  const { pushGeneric } = useSnackbar();
  const deployments = useSelector(state => state.management.lands.deployments[land.id]);
  const scenes = useMemo(
    () => toLandScenes(deployments ?? [], hash => new Lands().getContentSrcUrl(hash)),
    [deployments],
  );
  const dispatch = useDispatch();
  const deployers = useSelector(state => state.management.lands.deployers);
  const [sortBy, setSortBy] = useState(SortBy.LATEST);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [warning, setWarning] = useState<LandScene | null>(null);
  const [unpublish, setUnpublish] = useState<UnpublishTarget | null>(null);
  const cancelled = useRef(new Set<string>());
  const visible = selectScenes(scenes, { sortBy, query });
  const sorted = SORTED[sortBy];

  useEffect(() => {
    if (scenes.length) void dispatch(fetchLandDeployers(scenes.map(scene => scene.id)));
  }, [scenes, dispatch]);

  const header = (column: SortColumn, label: TranslationPath, className?: string) => (
    <th
      className={className}
      aria-sort={sorted.column === column ? sorted.direction : undefined}
    >
      {t(label)}
      {sorted.column === column && <ArrowDownIcon className="SortArrow" />}
    </th>
  );
  const landName = getLandName(project);

  const toggle = (id: string) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setDownload = (id: string, state: DownloadState) =>
    setDownloads(current => ({ ...current, [id]: state }));

  const download = async (scene: LandScene) => {
    setWarning(null);
    const outputPath = await misc.showSaveDialog({
      defaultPath: `${slugify(scene.title)}.zip`,
      filters: [{ name: 'Zip', extensions: ['zip'] }],
    });
    if (!outputPath) return;
    setDownload(scene.id, { kind: 'running', done: 0, total: 0 });
    const progress = sceneExport.subscribeProgress(scene.id, ({ done, total }) =>
      setDownload(scene.id, { kind: 'running', done, total }),
    );
    try {
      const result = await sceneExport.exportScene({
        entityId: scene.id,
        peerUrl: config.get('PEER_URL'),
        outputPath,
      });
      const message = RESULT_MESSAGE[result.recovered];
      pushGeneric(message.severity, t(message.key));
    } catch {
      if (!cancelled.current.has(scene.id)) {
        pushGeneric('error', t('land_detail.download.error', { scene: scene.title }));
      }
    } finally {
      progress.cleanup();
      cancelled.current.delete(scene.id);
      setDownload(scene.id, IDLE);
    }
  };

  const cancelDownload = (scene: LandScene) => {
    cancelled.current.add(scene.id);
    void sceneExport.cancel(scene.id);
  };

  if (!scenes.length) {
    return (
      <EmptyState
        title={t('land_detail.scenes.empty')}
        action={{
          label: t('manage.cards.no_scene.view_scenes'),
          variant: 'secondary',
          onClick: () => navigate('/scenes'),
        }}
      />
    );
  }

  const selectedScenes = scenes.filter(scene => selected.has(scene.id));
  const allSelected = visible.length > 0 && visible.every(scene => selected.has(scene.id));

  return (
    <Root>
      <ScenesBar>
        {mode === 'manage' && selectedScenes.length ? (
          <Bulk role="status">
            {t('land_detail.scenes.selected', { count: selectedScenes.length })}
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={() =>
                setUnpublish(
                  selectedScenes.length === 1
                    ? { kind: 'one', scene: selectedScenes[0] }
                    : { kind: 'many', scenes: selectedScenes },
                )
              }
            >
              {t('land_detail.scenes.unpublish_selected')}
            </Button>
          </Bulk>
        ) : (
          <Stats>
            <Meta>
              <LayersIcon />
              {t('manage.cards.scenes_count', { count: scenes.length })}
            </Meta>
            {project.place?.kind === 'estate' && (
              <Meta>
                <LayoutOutlineIcon className="LandsGlyph" />
                {t('manage.cards.land.lands_count', { count: project.place.size })}
              </Meta>
            )}
          </Stats>
        )}
        <>
          <SelectField
            label="manage.sort_by"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={setSortBy}
          />
          <SearchField onSearch={setQuery} />
        </>
      </ScenesBar>
      {visible.length ? (
        <Table>
          <thead>
            <tr>
              {mode === 'manage' && (
                <th className="Select">
                  <SelectCheckbox
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(visible.map(scene => scene.id)))
                    }
                    inputProps={{ 'aria-label': t('land_detail.scenes.select_all') }}
                  />
                </th>
              )}
              {header('name', 'land_detail.scenes.columns.name', 'Name')}
              <th>{t('land_detail.scenes.columns.parcels')}</th>
              <th>{t('land_detail.scenes.columns.location')}</th>
              {header('updated', 'land_detail.scenes.columns.last_updated')}
              <th>{t('land_detail.scenes.columns.published_by')}</th>
              <th className="Actions" />
            </tr>
          </thead>
          <tbody>
            {visible.map(scene => (
              <SceneRow
                key={scene.id}
                scene={scene}
                mode={mode}
                selected={selected.has(scene.id)}
                download={downloads[scene.id] ?? IDLE}
                deployer={deployers[scene.id]}
                onSelect={() => toggle(scene.id)}
                onDownload={() => setWarning(scene)}
                onCancelDownload={() => cancelDownload(scene)}
                onUnpublish={() => setUnpublish({ kind: 'one', scene })}
              />
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          title={t('manage.empty_list.search.title')}
          description={t('manage.empty_list.search.description')}
        />
      )}
      <DefaultModal
        open={!!warning}
        title={t('land_detail.download.title', { scene: warning?.title ?? '' })}
        onClose={() => setWarning(null)}
        body={t('land_detail.download.body')}
        secondary={{ label: t('modal.cancel'), onClick: () => setWarning(null) }}
        primary={{
          label: t('land_detail.download.confirm'),
          state: 'idle',
          onClick: () => warning && void download(warning),
        }}
      />
      {unpublish && (
        <UnpublishSceneModal
          open
          target={unpublish}
          landName={landName}
          onClose={() => setUnpublish(null)}
          onUnpublished={ids =>
            setSelected(current => new Set([...current].filter(id => !ids.includes(id))))
          }
        />
      )}
    </Root>
  );
}
