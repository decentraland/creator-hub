import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ChevronRight';
import MultiSceneIcon from '@mui/icons-material/Layers';
import ParcelsIcon from '@mui/icons-material/GridOn';
import OutlinedParcelsIcon from '@mui/icons-material/GridViewOutlined';
import LocationIcon from '@mui/icons-material/LocationOn';
import type { SceneParcels, WorldConfiguration } from '@dcl/schemas';
import {
  MenuItem,
  Select,
  Typography,
  type SelectChangeEvent,
  Switch,
  Box,
} from 'decentraland-ui2';

import type { Project } from '/shared/types/projects';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';
import { misc } from '#preload';
import { useDispatch, useSelector } from '#store';

import { config } from '/@/config';
import { formatWorldSize, getBaseParcel, getWorldDimensions } from '/@/modules/world';
import { t } from '/@/modules/store/translation/utils';
import { fetchENSList } from '/@/modules/store/ens';
import { ENSProvider } from '/@/modules/store/ens/types';
import { getEnsProvider } from '/@/modules/store/ens/utils';
import type { ParcelsPermission, WorldSettingsState } from '/@/modules/store/management';
import {
  actions as managementActions,
  hasWorldWidePermission,
  selectors as managementSelectors,
} from '/@/modules/store/management';
import { addBase64ImagePrefix } from '/@/modules/image';
import { useEditor } from '/@/hooks/useEditor';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { useAuth } from '/@/hooks/useAuth';
import { WorldPermissionName, type WorldScene } from '/@/lib/worlds';
import { coordsToId } from '/@/lib/land';

import EmptyWorldSVG from '/assets/images/empty-deploy-to-world.svg';
import LogoDCLSVG from '/assets/images/logo-dcl.svg';
import LogoENSSVG from '/assets/images/logo-ens.svg';

import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { Loader } from '/@/components/Loader';
import { Image } from '/@/components/Image';
import { type AtlasScene, WorldAtlas, WorldAtlasColors } from '/@/components/WorldAtlas';
import { PublishModal } from '../../PublishModal';
import { ProjectStepWrapper } from '../../ProjectStepWrapper';
import { COLORS, type Props, type Coordinate } from '../../types';
import {
  calculateParcels,
  countOverlappedWorldScenes,
  getWorldPlaceContinuityBreak,
  parseCoords,
} from '../../utils';
import { PlaceContinuityWarning } from '../../PlaceContinuityWarning';

import './styles.css';

const WORLDS_CONTENT_SERVER = config.get('WORLDS_CONTENT_SERVER_URL');

enum Step {
  SELECTION = 'selection',
  LOCATION = 'location',
  CONFIRM_OVERWRITE = 'confirm-overwrite',
}

export function PublishToWorld(props: Props) {
  const { project, publishScene } = useEditor();
  const { updateSceneJson, updateProject } = useWorkspace();
  const { wallet } = useAuth();
  const dispatch = useDispatch();
  const names = useSelector(state => state.ens.data);
  const [name, setName] = useState<string>('');
  /** The owner's or a world-wide collaborator's own pick on the switch; null keeps the default. */
  const [multiSceneChoice, setMultiSceneChoice] = useState<boolean | null>(null);
  const worldSettings = useSelector(managementSelectors.getWorldSettings);
  const worldPermissions = useSelector(state =>
    managementSelectors.getParcelsStateForAddress(state, wallet || ''),
  );
  const [step, setStep] = useState<Step>(Step.SELECTION);
  /** Step the confirmation was reached from, so going back returns to it. */
  const [confirmOrigin, setConfirmOrigin] = useState<Step>(Step.LOCATION);
  /**
   * Parcels of the deployment awaiting confirmation. Kept apart from the store project: the
   * inspector re-sends its own (older) scene metadata after scene.json is written, which would
   * make the confirmation describe the wrong parcels.
   */
  const [pendingScene, setPendingScene] = useState<SceneParcels | null>(null);

  /**
   * The NAME list has four outcomes and they are not interchangeable. Deriving everything
   * from `names` being empty made "still loading", "the subgraph failed" and "you own no
   * NAMEs" render the same screen — so a slow load looked like an empty account, and a
   * `.zone` subgraph outage looked like one too. `status` is what tells them apart.
   */
  const namesStatus = useSelector(state => state.ens.status);
  const hasNames = Object.keys(names).length > 0;
  const isLoadingNames = !hasNames && (namesStatus === 'idle' || namesStatus === 'loading');
  const namesFailed = !hasNames && namesStatus === 'failed';
  const emptyNames = !hasNames && namesStatus === 'succeeded';

  const handleRetryNames = useCallback(() => {
    if (wallet) dispatch(fetchENSList({ address: wallet }));
  }, [dispatch, wallet]);

  const isOwner: boolean = useMemo(() => {
    if (!name || !wallet) return false;
    return names[name]?.nftOwnerAddress?.toLocaleLowerCase() === wallet.toLocaleLowerCase();
  }, [names, name, wallet]);

  const hasWorldWidePermissions: boolean = useMemo(() => {
    return isOwner || hasWorldWidePermission(worldPermissions);
  }, [isOwner, worldPermissions]);

  // Derived, not synced by an effect: re-picking the world already in the store changes neither
  // the permissions nor the scene count, so an effect keyed on them never re-ran and the reset
  // to single scene stuck (a restricted collaborator, whose switch is locked, saw the
  // "lose its Places listing" warning instead of the parcel picker).
  // A restricted collaborator always has to choose a location.
  const isMultiSceneEnabled =
    !hasWorldWidePermissions || (multiSceneChoice ?? worldSettings.scenes.length > 1);

  const handleBack = useCallback(() => {
    if (step === Step.CONFIRM_OVERWRITE) {
      setStep(confirmOrigin);
    } else if (step === Step.LOCATION) {
      setStep(Step.SELECTION);
    } else {
      props.onBack?.();
    }
  }, [step, confirmOrigin, props.onBack]);

  const loadWorld = useCallback(
    (worldName: string) => {
      dispatch(managementActions.fetchWorldSettings({ worldName }));
      dispatch(managementActions.fetchWorldScenes({ worldName }));
      dispatch(
        managementActions.fetchParcelsPermission({
          worldName,
          permissionName: WorldPermissionName.Deployment,
          walletAddress: wallet || '',
        }),
      );
    },
    [wallet],
  );

  const handleChangeName = useCallback(
    (worldName: string) => {
      setMultiSceneChoice(null);
      setName(worldName);
      loadWorld(worldName);
    },
    [loadWorld],
  );

  const handleRetryLoadWorld = useCallback(() => loadWorld(name), [loadWorld, name]);

  const worldLoadFailed =
    !!name &&
    (worldSettings.status === 'failed' ||
      worldSettings.scenesStatus === 'failed' ||
      (!isOwner && worldPermissions?.status === 'failed'));

  // Single vs multi scene is decided from the scenes and the permissions, so the next step
  // waits for both instead of deciding (and warning) on what is still loading.
  const worldLoading =
    !!name &&
    (worldSettings.status === 'loading' ||
      worldSettings.scenesStatus === 'loading' ||
      (!isOwner && worldPermissions?.status === 'loading'));

  // Every choice made across the steps (world name, then location), so the publish can
  // put all of them in the scene.json it deploys rather than only the last step's.
  const chosenUpdates = useRef<Partial<Project>>({});

  const handleUpdateProject = useCallback(
    async (projectUpdates: Partial<Project>) => {
      if (!project) return;
      chosenUpdates.current = { ...chosenUpdates.current, ...projectUpdates };
      await updateSceneJson(project.path, projectUpdates);
      updateProject({ ...project, ...projectUpdates, updatedAt: Date.now() });
    },
    [project, updateSceneJson, updateProject],
  );

  const handlePublish = useCallback(
    async (projectUpdates?: Partial<Project>) => {
      if (projectUpdates) await handleUpdateProject(projectUpdates);
      const { worldConfiguration, scene } = chosenUpdates.current;
      // The deploy step reports a failed publish from the store (publishError).
      publishScene({
        targetContent: WORLDS_CONTENT_SERVER,
        sceneUpdates: {
          ...(worldConfiguration && { worldConfiguration }),
          ...(scene && { scene }),
        },
      })?.catch(() => undefined);
      props.onStep('deploy', { deploymentMetadata: { isMultiScene: isMultiSceneEnabled } });
    },
    [isMultiSceneEnabled, props.onStep, publishScene, handleUpdateProject],
  );

  const handleSelectLocation = useCallback(
    async (projectUpdates: Partial<Project>) => {
      if (projectUpdates) await handleUpdateProject(projectUpdates);
      setStep(Step.LOCATION);
    },
    [handleUpdateProject],
  );

  const handleShowConfirmation = useCallback(
    async (projectUpdates: Partial<Project>, origin: Step = Step.LOCATION) => {
      setPendingScene(projectUpdates.scene ?? null);
      if (projectUpdates) await handleUpdateProject(projectUpdates);
      setConfirmOrigin(origin);
      setStep(Step.CONFIRM_OVERWRITE);
    },
    [handleUpdateProject],
  );

  useEffect(() => {
    // Initialize the name and world settings when the project is loaded
    // We use handleChangeName to also fetch the world settings, scenes and permissions
    if (project?.worldConfiguration?.name && names[project.worldConfiguration.name]) {
      handleChangeName(project.worldConfiguration.name);
    }
  }, []);

  return (
    <PublishModal
      title={t('modal.publish_project.worlds.select_world.title')}
      data-testid="publish-modal-publish-to-world"
      size="large"
      {...props}
      onBack={handleBack}
    >
      {isLoadingNames ? (
        <LoadingNames />
      ) : namesFailed ? (
        <NamesError onRetry={handleRetryNames} />
      ) : emptyNames ? (
        <EmptyNames />
      ) : hasNames && project ? (
        <ProjectStepWrapper
          isWorld
          name={name}
          project={project}
        >
          {worldLoadFailed && (
            <Box className="WorldLoadError">
              <Typography
                variant="body2"
                color="error"
              >
                {t('modal.publish_project.worlds.select_world.load_error')}
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={handleRetryLoadWorld}
              >
                {t('modal.publish_project.worlds.select_world.actions.retry')}
              </Button>
            </Box>
          )}
          {step === Step.SELECTION && (
            <SelectWorld
              name={name}
              project={project}
              worldSettings={worldSettings}
              isMultiSceneEnabled={isMultiSceneEnabled}
              onChangeMultiScene={setMultiSceneChoice}
              hasWorldWidePermissions={hasWorldWidePermissions}
              worldLoadFailed={worldLoadFailed}
              worldLoading={worldLoading}
              onChangeName={handleChangeName}
              onSelectLocation={handleSelectLocation}
              onShowConfirmation={updates => handleShowConfirmation(updates, Step.SELECTION)}
              onPublish={handlePublish}
            />
          )}
          {step === Step.LOCATION && (
            <SelectLocation
              project={project}
              worldScenes={worldSettings.scenes}
              worldPermissions={worldPermissions}
              hasWorldWidePermissions={hasWorldWidePermissions}
              onShowConfirmation={handleShowConfirmation}
              onPublish={handlePublish}
            />
          )}
          {step === Step.CONFIRM_OVERWRITE && (
            <ConfirmOverwrite
              parcels={pendingScene?.parcels ?? project.scene.parcels}
              worldScenes={worldSettings.scenes}
              isMultiScene={isMultiSceneEnabled}
              onCancel={handleBack}
              onConfirm={() => handlePublish()}
            />
          )}
        </ProjectStepWrapper>
      ) : null}
    </PublishModal>
  );
}

function SelectWorld({
  name,
  project,
  worldSettings,
  hasWorldWidePermissions,
  worldLoadFailed,
  worldLoading,
  isMultiSceneEnabled,
  onChangeMultiScene,
  onChangeName,
  onSelectLocation,
  onShowConfirmation,
  onPublish,
}: {
  name: string;
  project: Project;
  worldSettings: WorldSettingsState;
  hasWorldWidePermissions: boolean;
  worldLoadFailed: boolean;
  worldLoading: boolean;
  isMultiSceneEnabled: boolean;
  onChangeMultiScene: (isMultiSceneEnabled: boolean) => void;
  onChangeName: (name: string) => void;
  onSelectLocation: (projectUpdates: Partial<Project>) => void;
  onShowConfirmation: (projectUpdates: Partial<Project>) => void;
  onPublish: (projectUpdates: Partial<Project>) => Promise<void>;
}) {
  const names = useSelector(state => state.ens.data);
  const [ensProvider, setENSProvider] = useState(
    project.worldConfiguration?.name
      ? getEnsProvider(project.worldConfiguration?.name)
      : ENSProvider.DCL,
  );

  const worldSize = useMemo(() => {
    const { width, height } = getWorldDimensions(worldSettings.scenes || []);
    return width !== 0 && height !== 0
      ? formatWorldSize({ width, height })
      : formatWorldSize({ width: project.layout.cols, height: project.layout.rows });
  }, [worldSettings.scenes]);

  const listNames = useMemo(() => {
    const _names = [];
    for (const ens in names) {
      if (names[ens].provider === ensProvider) {
        _names.push(names[ens].subdomain);
      }
    }
    return _names;
  }, [names, ensProvider]);

  const handleClaimNewName = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      event.preventDefault();
      if (ensProvider === ENSProvider.DCL) {
        misc.openExternal('https://decentraland.org/marketplace/names/claim');
      } else {
        misc.openExternal('https://ens.domains');
      }
    },
    [ensProvider],
  );

  const handleChangeSelectProvider = useCallback(
    (e: SelectChangeEvent) => {
      setENSProvider(e.target.value as ENSProvider);
      onChangeName('');
    },
    [onChangeName],
  );

  const handleChangeSelectName = useCallback(
    (e: SelectChangeEvent) => {
      if (!e.target.value) return;
      onChangeName(e.target.value);
    },
    [onChangeName],
  );

  const handleNext = useCallback(async () => {
    const worldConfiguration: WorldConfiguration = { ...project.worldConfiguration, name };

    if (isMultiSceneEnabled && worldSettings.scenes.length > 0) {
      onSelectLocation({ worldConfiguration });
    } else {
      // In single scene mode, ensure the project base parcel is 0,0.
      const scene: SceneParcels = {
        base: coordsToId(0, 0),
        parcels: calculateParcels(project, { x: 0, y: 0 }).map(parcel =>
          coordsToId(parcel.x, parcel.y),
        ),
      };
      if (getWorldPlaceContinuityBreak(worldSettings.scenes, scene.parcels, isMultiSceneEnabled)) {
        onShowConfirmation({ worldConfiguration, scene });
      } else {
        onPublish({ worldConfiguration, scene });
      }
    }
  }, [
    project,
    name,
    isMultiSceneEnabled,
    worldSettings.scenes,
    onPublish,
    onSelectLocation,
    onShowConfirmation,
  ]);

  // Only an in-flight thumbnail save blocks publishing (so the deploy doesn't
  // race the file write). `status` stays undefined when no thumbnail was ever
  // captured — the Bevy renderer's screenshot is best-effort and may never
  // dispatch the save — and a failed save is likewise no reason to block:
  // the thumbnail is decorative, the deploy works without it.
  const projectIsReady = project.status !== 'loading';

  return (
    <div
      className="SelectWorld"
      data-testid="publish-modal-publish-to-world-select-world"
    >
      <div className="selection">
        <Typography
          variant="h6"
          color="#A09BA8"
        >
          {t('modal.publish_project.worlds.select_world.description')}
        </Typography>
        <Row>
          <Select
            variant="outlined"
            color="secondary"
            className="SelectWorld-ENSProvider"
            data-testid="publish-modal-publish-to-world-select-world-ens-provider"
            value={ensProvider}
            onChange={handleChangeSelectProvider}
          >
            <MenuItem
              value={ENSProvider.DCL}
              data-testid="publish-modal-publish-to-world-select-world-ens-provider-dcl"
            >
              <img
                className="SelectWorld-ENSProvider-Img"
                src={LogoDCLSVG}
              />
              {t(`modal.publish_project.worlds.select_world.ens_providers.${ENSProvider.DCL}`)}
            </MenuItem>
            <MenuItem
              value={ENSProvider.ENS}
              data-testid="publish-modal-publish-to-world-select-world-ens-provider-ens"
            >
              <img
                className="SelectWorld-ENSProvider-Img"
                src={LogoENSSVG}
              />
              {t(`modal.publish_project.worlds.select_world.ens_providers.${ENSProvider.ENS}`)}
            </MenuItem>
          </Select>
          <Select
            variant="outlined"
            color="secondary"
            className="SelectWorld-WorldName"
            data-testid="publish-modal-publish-to-world-select-world-select"
            displayEmpty
            value={name}
            onChange={handleChangeSelectName}
            disabled={listNames.length === 0}
            endAdornment={worldSettings.status === 'loading' ? <Loader size="20px" /> : null}
            renderValue={selected => {
              if (selected === '') {
                return <em>{t('modal.publish_project.worlds.select_world.placeholder')}</em>;
              }

              return selected;
            }}
          >
            <MenuItem
              disabled
              value=""
            >
              <em>{t('modal.publish_project.worlds.select_world.placeholder')}</em>
            </MenuItem>
            {listNames.map((_world: string) => (
              <MenuItem
                key={_world}
                value={_world}
                data-testid={`publish-modal-publish-to-world-select-world-select-item-${_world.toLowerCase()}`}
              >
                {_world}
              </MenuItem>
            ))}
            <MenuItem onClick={handleClaimNewName}>
              <AddIcon />
              {ensProvider === ENSProvider.DCL
                ? t('modal.publish_project.worlds.select_world.claim_new_name')
                : t('modal.publish_project.worlds.select_world.claim_new_ens_domain')}
            </MenuItem>
          </Select>
        </Row>
      </div>
      {name && (
        <div className="AdvancedSettings">
          <Row>
            <MultiSceneIcon />
            <div className="AdvancedSettingsHeaderTexts">
              <Typography>
                {t('modal.publish_project.worlds.select_world.multi_scene.title')}
              </Typography>
              <Typography
                variant="body2"
                className="AdvancedSettingsDescription"
              >
                {t('modal.publish_project.worlds.select_world.multi_scene.description')}
              </Typography>
            </div>
            <Switch
              checked={isMultiSceneEnabled}
              onChange={(_e, checked) => onChangeMultiScene(checked)}
              disabled={!hasWorldWidePermissions}
            />
          </Row>
          {isMultiSceneEnabled && worldSettings.status !== 'loading' && (
            <div className="WorldInfo">
              <div className="WorldThumbnail">
                <Image
                  src={
                    worldSettings.settings?.thumbnail ||
                    addBase64ImagePrefix(project.thumbnail) ||
                    ''
                  }
                  alt={worldSettings.settings?.title || ''}
                  fallbackSrc={FallbackThumbnail}
                />
              </div>
              <div className="WorldInfoContent">
                <Typography className="CurrentWorldLabel">
                  {t('modal.publish_project.worlds.select_world.multi_scene.current_world')}
                </Typography>
                <Typography
                  variant="h6"
                  className="WorldTitle"
                >
                  {worldSettings.settings?.title || project.title}
                </Typography>
                <Row className="WorldMetadata">
                  <InfoItem
                    icon={<MultiSceneIcon />}
                    label={t('modal.publish_project.worlds.select_world.multi_scene.scenes_count', {
                      count: worldSettings.scenes?.length || 1,
                    })}
                  />
                  <InfoItem
                    icon={<ParcelsIcon />}
                    label={worldSize}
                  />
                </Row>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="actions">
        <Button
          data-testid="publish-modal-publish-to-world-select-world-action"
          onClick={handleNext}
          size="large"
          disabled={!projectIsReady || !name || worldLoadFailed || worldLoading}
          endIcon={<ArrowForwardIcon />}
        >
          {isMultiSceneEnabled && worldSettings.scenes.length > 0
            ? t('modal.publish_project.worlds.select_world.actions.select_location')
            : t('modal.publish_project.worlds.select_world.actions.review')}
        </Button>
      </div>
    </div>
  );
}

function InfoItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  if (!label) return null;
  return (
    <div className="WorldInfoItem">
      {icon}
      <Typography variant="body2">{label}</Typography>
    </div>
  );
}

function SelectLocation({
  worldScenes,
  worldPermissions,
  project,
  hasWorldWidePermissions,
  onPublish,
  onShowConfirmation,
}: {
  worldScenes: WorldScene[];
  worldPermissions?: ParcelsPermission;
  project: Project;
  hasWorldWidePermissions: boolean;
  onPublish: (projectUpdates: Partial<Project>) => void;
  onShowConfirmation: (projectUpdates: Partial<Project>) => void;
}) {
  const permissionsSet = useMemo(
    () => new Set(worldPermissions?.parcels ?? []),
    [worldPermissions?.parcels],
  );
  const [hover, setHover] = useState<Coordinate | null>(null);
  const [placement, setPlacement] = useState<Coordinate | null>(getInitialPlacement);

  const noParcelsFit: boolean = useMemo(() => {
    // TODO: in the future we should make this more accurate by checking if the project parcels shape fits in the available parcels shape.
    return (
      !placement && permissionsSet.size > 0 && permissionsSet.size < project.scene.parcels?.length
    );
  }, [placement, permissionsSet, project.scene.parcels]);

  function getInitialPlacement(): Coordinate | null {
    if (project.scene.base) {
      // If project has a base parcel, check if the user has permission to deploy into it
      // before setting the initial placement.
      const [x, y] = parseCoords(project.scene.base);
      if (
        hasWorldWidePermissions ||
        calculateParcels(project, { x, y }).every(parcel =>
          permissionsSet.has(coordsToId(parcel.x, parcel.y)),
        )
      ) {
        return { x, y };
      }
    }
    if (hasWorldWidePermissions && !worldScenes.length) {
      return { x: 0, y: 0 };
    }
    return null;
  }

  const atlasInitialCenter: Coordinate | null = useMemo(() => {
    if (placement) {
      return placement;
    } else if (worldPermissions?.parcels.length) {
      // If the user has parcel-specific permissions, center the atlas on the first parcel available.
      const [x, y] = parseCoords(worldPermissions.parcels[0]);
      return { x, y };
    }
    return null;
  }, []); // Just calculate the initial center once when the component mounts.

  const sceneParcelsSet = useMemo(
    () => new Set(worldScenes.flatMap(scene => scene.parcels ?? [])),
    [worldScenes],
  );

  // Memoize the project parcels centered around the hover position only if not placed
  const hoverProjectParcels = useMemo(
    () =>
      new Set(
        hover ? calculateParcels(project, hover).map(parcel => coordsToId(parcel.x, parcel.y)) : [],
      ),
    [project, hover, placement],
  );

  const placedProjectParcels = useMemo(
    () =>
      new Set(
        placement
          ? calculateParcels(project, placement).map(parcel => coordsToId(parcel.x, parcel.y))
          : [],
      ),
    [project, placement],
  );

  /** World scenes list with the placement parcel added. */
  const newWorldScenes: AtlasScene[] = useMemo(() => {
    if (!placement) return worldScenes;
    return [...worldScenes, { parcels: Array.from(placedProjectParcels) }];
  }, [worldScenes, placement, placedProjectParcels]);

  const isValidHoverPlacement = useMemo(() => {
    return (
      hover &&
      (hasWorldWidePermissions ||
        Array.from(hoverProjectParcels).every(parcel => worldPermissions?.parcels.includes(parcel)))
    );
  }, [hasWorldWidePermissions, worldPermissions, hover, hoverProjectParcels]);

  const isHoveredParcel = useCallback(
    (x: number, y: number) => hoverProjectParcels.has(coordsToId(x, y)),
    [hoverProjectParcels],
  );

  const isPlacedParcel = useCallback(
    (x: number, y: number) => placedProjectParcels.has(coordsToId(x, y)),
    [placedProjectParcels],
  );

  const isOverlappingScenes = useMemo(() => {
    return Array.from(placedProjectParcels).some(parcel => sceneParcelsSet.has(parcel));
  }, [placedProjectParcels, sceneParcelsSet]);

  /** Parcels where the user has or not deployment permission if they are collaborators. */
  const permissionsLayer = useCallback(
    (x: number, y: number) =>
      hasWorldWidePermissions || worldPermissions?.parcels.includes(coordsToId(x, y))
        ? null // Available parcel color is applied by default.
        : { color: WorldAtlasColors.noPermissionParcel, scale: 1.1 }, // Darken the parcel to make it "not available".
    [hasWorldWidePermissions, worldPermissions],
  );

  const placedStrokeLayer = useCallback(
    (x: number, y: number) =>
      isPlacedParcel(x, y) ? { color: COLORS.selectedStroke, scale: 1.35 } : null,
    [isPlacedParcel],
  );

  const placedHighlightLayer = useCallback(
    (x: number, y: number) =>
      isPlacedParcel(x, y) ? { color: COLORS.selected, scale: 1.15 } : null,
    [isPlacedParcel],
  );

  const hoverLayer = useCallback(
    (x: number, y: number) => {
      return isHoveredParcel(x, y)
        ? { color: isValidHoverPlacement ? COLORS.selected : COLORS.indicator, scale: 1.1 }
        : null;
    },
    [isHoveredParcel, isValidHoverPlacement],
  );

  const handleHover = useCallback((x: number, y: number) => {
    setHover({ x, y });
  }, []);

  const handleSelectParcel = useCallback(
    (x: number, y: number) => {
      if (isValidHoverPlacement) {
        setPlacement({ x, y });
      }
    },
    [isValidHoverPlacement],
  );

  const handleReset = useCallback(() => {
    setPlacement(null);
    setHover(null);
  }, []);

  const handleNext = useCallback(async () => {
    if (!placement) return;
    const scene: SceneParcels = {
      base: coordsToId(placement.x, placement.y),
      parcels: Array.from(placedProjectParcels),
    };
    // Multi-scene mode: only an overlap can break the Place continuity, and an overlap already
    // goes through the confirmation.
    if (isOverlappingScenes) {
      onShowConfirmation({ scene });
    } else {
      onPublish({ scene });
    }
  }, [placement, placedProjectParcels, isOverlappingScenes, onShowConfirmation, onPublish]);

  return (
    <div className="SelectLocation">
      <Typography
        variant="h6"
        color="#A09BA8"
      >
        {t('modal.publish_project.worlds.select_world.location.description')}
      </Typography>
      <WorldAtlas
        layers={[permissionsLayer, placedStrokeLayer, placedHighlightLayer, hoverLayer]}
        onHover={handleHover}
        onClick={handleSelectParcel}
        worldScenes={newWorldScenes}
        colorsOverride={!hasWorldWidePermissions ? { availableParcel: '#43404a' } : undefined}
        floatingContent={
          permissionsSet.size > 0 && (
            <Box className="AvailableParcelsCount">
              <OutlinedParcelsIcon />
              <Typography variant="body2">
                {t('modal.publish_project.worlds.select_world.location.available_parcels_count', {
                  count: permissionsSet.size,
                })}
              </Typography>
            </Box>
          )
        }
        height={350}
        x={atlasInitialCenter?.x}
        y={atlasInitialCenter?.y}
      />
      <div className="actions">
        {noParcelsFit && (
          <Typography
            variant="body2"
            color="#FB3B3B"
          >
            {t('modal.publish_project.worlds.select_world.location.no_parcels_fit_error')}
          </Typography>
        )}

        {placement && (
          <Button
            variant="outlined"
            color="secondary"
            size="large"
            onClick={handleReset}
          >
            {t('modal.publish_project.worlds.select_world.actions.reset')}
          </Button>
        )}
        {placement && project.scene.parcels?.length > 0 && (
          <Typography className="SelectedParcelInfo">
            {t('modal.publish_project.worlds.select_world.location.parcels_place', {
              count: project.scene.parcels.length,
            })}
            <LocationIcon />
            {`${placement.x}, ${placement.y}`}
          </Typography>
        )}
        <Button
          size="large"
          onClick={handleNext}
          disabled={!placement || noParcelsFit}
          endIcon={<ArrowForwardIcon />}
        >
          {t('modal.publish_project.worlds.select_world.actions.review')}
        </Button>
      </div>
    </div>
  );
}

function ConfirmOverwrite({
  parcels,
  worldScenes,
  isMultiScene,
  onCancel,
  onConfirm,
}: {
  parcels: string[];
  worldScenes: WorldScene[];
  isMultiScene: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const replacedScenes = useMemo(() => {
    return worldScenes.filter(scene => {
      const sceneParcels = new Set(scene.parcels);
      return parcels.some(parcel => sceneParcels.has(parcel));
    });
  }, [worldScenes, parcels]);

  const overlap = useMemo(
    () => countOverlappedWorldScenes(worldScenes, parcels),
    [worldScenes, parcels],
  );
  const continuityBreak = getWorldPlaceContinuityBreak(worldScenes, parcels, isMultiScene);
  const hasReplacedScenes = replacedScenes.length > 0;

  return (
    <div className="ConfirmOverwrite">
      {hasReplacedScenes ? (
        <>
          <Typography variant="h5">
            {t('modal.publish_project.worlds.select_world.confirm_overwrite.title')}
          </Typography>
          <Typography variant="body2">
            {t('modal.publish_project.worlds.select_world.confirm_overwrite.scenes_count', {
              count: replacedScenes.length,
              b: (child: string) => <b>{child}</b>,
            })}
          </Typography>
        </>
      ) : null}
      <ul className="ScenesList">
        {replacedScenes.map((scene, index) => (
          <li key={scene.entityId}>
            <Typography variant="body2">
              <b>
                {scene.entity.metadata?.display?.title ||
                  t(
                    'modal.publish_project.worlds.select_world.confirm_overwrite.scene_title_placeholder',
                    { index: index + 1 },
                  )}{' '}
              </b>
              <span>({getBaseParcel(scene.parcels || [])?.join(', ') || ''})</span>
            </Typography>
          </li>
        ))}
      </ul>
      {hasReplacedScenes && (
        <Typography variant="body2">
          {t('modal.publish_project.worlds.select_world.confirm_overwrite.description')}
        </Typography>
      )}
      {continuityBreak === 'merge' && (
        <PlaceContinuityWarning
          kind="world-merge"
          overlap={overlap}
        />
      )}
      {continuityBreak === 'replace-world' && <PlaceContinuityWarning kind="world-replace" />}
      <div className="actions">
        <Button
          color="secondary"
          size="large"
          fullWidth
          onClick={onCancel}
        >
          {t('modal.publish_project.worlds.select_world.actions.cancel')}
        </Button>
        <Button
          size="large"
          fullWidth
          onClick={onConfirm}
        >
          {t('modal.publish_project.worlds.select_world.actions.confirm')}
        </Button>
      </div>
    </div>
  );
}

/** Shown while the NAME list is still being fetched, so a slow load is not mistaken for an
 *  account that owns nothing. */
function LoadingNames() {
  return (
    <div
      className="LoadingNames"
      data-testid="publish-modal-names-loading"
    >
      <Loader />
      <Typography
        variant="h6"
        textAlign="center"
      >
        {t('modal.publish_project.worlds.loading_names.title')}
      </Typography>
    </div>
  );
}

/** Shown when the NAME lookup failed (typically a subgraph outage). Without this the user
 *  saw "you have no Worlds" and had no way to retry. */
function NamesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="NamesError"
      data-testid="publish-modal-names-error"
    >
      <Typography
        variant="h6"
        textAlign="center"
      >
        {t('modal.publish_project.worlds.names_error.title')}
      </Typography>
      <Typography
        variant="body2"
        textAlign="center"
      >
        {t('modal.publish_project.worlds.names_error.description')}
      </Typography>
      <Button
        data-testid="publish-modal-names-error-retry"
        onClick={onRetry}
      >
        {t('modal.publish_project.worlds.names_error.action')}
      </Button>
    </div>
  );
}

function EmptyNames() {
  const handleClick = useCallback(() => {
    misc.openExternal('https://decentraland.org/marketplace/names/claim');
  }, []);

  const handleClickLearnMore = useCallback(() => {
    misc.openExternal(
      'https://docs.decentraland.org/creator/worlds/about/#worlds-from-decentraland-names',
    );
  }, []);

  return (
    <div
      className="EmptyNames"
      data-testid="publish-modal-empty-names"
    >
      <Typography
        variant="h6"
        textAlign="center"
      >
        {t('modal.publish_project.worlds.empty_names.title')}
      </Typography>
      <img
        className="thumbnail"
        src={EmptyWorldSVG}
      />
      <Typography
        variant="body2"
        textAlign="center"
      >
        {t('modal.publish_project.worlds.empty_names.description', {
          b: (child: string) => <b>{child}</b>,
          br: () => <br />,
        })}
      </Typography>
      <div className="actions">
        <Button
          size="small"
          onClick={handleClick}
        >
          {t('modal.publish_project.worlds.empty_names.action')}
        </Button>
        <Button
          size="small"
          color="secondary"
          onClick={handleClickLearnMore}
        >
          {t('option_box.learn_more')}
        </Button>
      </div>
    </div>
  );
}
