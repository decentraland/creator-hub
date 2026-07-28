import { Color4 } from '@dcl/sdk/math';
import { isMobile as detectIsMobile } from '@dcl/sdk/platform';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is required for JSX factory
import ReactEcs, {
  Label,
  Button as DCLButton,
  UiEntity,
  type ReactBasedUiSystem,
} from '@dcl/react-ecs';
import { type Entity, type IEngine, type PointerEventsSystem } from '@dcl/ecs';
import {
  getComponents,
  type GetPlayerDataRes,
  type IPlayersHelper,
  type ISDKHelpers,
} from '../definitions';
import { VideoControl } from './VideoControl';
import { TextAnnouncementsControl } from './TextAnnouncementsControl';
import { SmartItemsControl } from './SmartItemsControl';
import { TextAnnouncements } from './TextAnnouncements';
import { getContentUrl } from './constants';
import { TabType } from './types';
import { ModerationControl, type SceneAdmin } from './ModerationControl';
import { getSceneAdmins, getSceneBans, type SceneBanUser } from './ModerationControl/api';
import { ModalUserList, UserListType } from './ModerationControl/UsersList';
import { startPresentationDetection } from './VideoControl/DclCast/presentation-detector';
import { findActiveCastScreenIndex } from './VideoControl/utils';
import { SpeakerShowcase } from './VideoControl/DclCast/SpeakerShowcase';
import SharePresentationModal from './VideoControl/DclCast/SharePresentationModal';
import { isPreview } from './fetch-utils';
import { initAdminMessageBus, getAdminMessageBus } from './admin-message-bus';
import { state } from './store';
import {
  setActiveTab,
  togglePanel,
  showPresentation,
  dismissPresentation,
  setAdminToolkitUiEntity,
} from './actions';
import { COLORS, RADIUS, SPACING, TYPE } from './theme';
import { IconTab, Divider } from './Primitives';

// Mobile scaling: shrink the virtual canvas on
// mobile so the SDK's global UI scale factor — min(screen/virtual), see
// @dcl/react-ecs getUiScaleFactor — multiplies EVERYTHING (geometry and
// fontSize) uniformly by MOBILE_UI_SCALE. We author a single base layout and
// mobile gets the zoom for free, including every child component's text.
const MOBILE_UI_SCALE = 2;
const BASE_VIRTUAL_UI_SIZE = { virtualWidth: 1920, virtualHeight: 1080 };

function getVirtualUiSize() {
  return detectIsMobile()
    ? {
        virtualWidth: BASE_VIRTUAL_UI_SIZE.virtualWidth / MOBILE_UI_SCALE,
        virtualHeight: BASE_VIRTUAL_UI_SIZE.virtualHeight / MOBILE_UI_SCALE,
      }
    : BASE_VIRTUAL_UI_SIZE;
}

let sceneAdminsCache: SceneAdmin[] = [];
let sceneBansCache: SceneBanUser[] = [];

const ADMIN_ICONS = {
  get BTN_ADMIN_TOOLKIT_CONTROL() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/admin-panel-control-button.png`;
  },
  get BTN_ADMIN_TOOLKIT_BACKGROUND() {
    return `${getContentUrl()}/admin_toolkit/assets/backgrounds/admin-tool-background.png`;
  },
};

// The editor starts using entities from [8001].
const ADMIN_TOOLS_ENTITY = 8000 as Entity;

function getAdminToolkitEntity(engine: IEngine) {
  const { AdminTools } = getComponents(engine);
  return Array.from(engine.getEntitiesWith(AdminTools))[0][0];
}

function getAdminToolkitComponent(engine: IEngine) {
  const { AdminTools } = getComponents(engine);
  return Array.from(engine.getEntitiesWith(AdminTools))[0][1];
}

export async function fetchSceneAdmins() {
  const [error, response] = await getSceneAdmins();

  if (error) {
    console.log(JSON.stringify({ error }));
    sceneAdminsCache = [];
    return;
  }
  sceneAdminsCache = (response ?? [])
    .map($ => ({
      name: $.name,
      address: $.admin,
      role: 'admin' as const,
      verified: !$.name.includes('#'),
      canBeRemoved: !!$.canBeRemoved,
    }))
    .sort(a => (a.canBeRemoved ? 1 : -1));
  if (adminDataInitialized) {
    getAdminMessageBus().updateAdminList(sceneAdminsCache);
  }
}

export async function fetchAndSyncSceneAdmins() {
  await fetchSceneAdmins();
  if (adminDataInitialized) {
    getAdminMessageBus().emitSyncAdmins();
  }
}

export async function fetchSceneBans() {
  const [error, response] = await getSceneBans();

  if (error) {
    sceneBansCache = [];
    return;
  }

  sceneBansCache = response?.results ?? [];
}

export function clearSceneBansCache() {
  sceneBansCache = [];
}

export function getSmartItems(engine: IEngine) {
  const adminToolkitComponent = getAdminToolkitComponent(engine);

  return Array.from(adminToolkitComponent.smartItemsControl.smartItems ?? []);
}

function initTextAnnouncementSync(engine: IEngine) {
  const { TextAnnouncements } = getComponents(engine);

  TextAnnouncements.createOrReplace(state.adminToolkitUiEntity, {
    text: '',
    author: '',
    id: '',
  });
}

let adminDataInitialized = false;
export async function initializeAdminData(
  engine: IEngine,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  if (!adminDataInitialized) {
    const { VideoControlState } = getComponents(engine);

    setAdminToolkitUiEntity(getAdminToolkitEntity(engine) ?? engine.addEntity());

    initTextAnnouncementSync(engine);

    if (!VideoControlState.getOrNull(state.adminToolkitUiEntity)) {
      VideoControlState.create(state.adminToolkitUiEntity);
    }

    sdkHelpers?.syncEntity?.(
      state.adminToolkitUiEntity,
      [VideoControlState.componentId],
      ADMIN_TOOLS_ENTITY,
    );

    await Promise.all([fetchSceneAdmins(), fetchSceneBans()]);

    initAdminMessageBus(
      engine,
      sceneAdminsCache,
      state.adminToolkitUiEntity,
      playersHelper,
      fetchSceneAdmins,
    );

    adminDataInitialized = true;

    console.log('initializeAdminData - initialized');
  }
}

export function createAdminToolkitUI(
  engine: IEngine,
  pointerEventsSystem: PointerEventsSystem,
  reactBasedUiSystem: ReactBasedUiSystem,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  initializeAdminData(engine, sdkHelpers, playersHelper).then(() => {
    console.log('createAdminToolkitUI - initialized');
    reactBasedUiSystem.setUiRenderer(
      () => uiComponent(engine, pointerEventsSystem, sdkHelpers, playersHelper),
      getVirtualUiSize(),
    );

    // Background service: auto-open the panel to the DCL Cast tab when a
    // presentation goes live, regardless of which tab (if any) the admin is on.
    startPresentationDetection(
      engine,
      () => !!isAllowedAdmin(engine, getAdminToolkitComponent(engine), playersHelper?.getPlayer()),
      () => playersHelper?.getPlayer()?.userId,
      () => showPresentation(findActiveCastScreenIndex(engine)),
      () => dismissPresentation(),
    );
  });
}

function isAllowedAdmin(
  _engine: IEngine,
  adminToolkitEntitie: ReturnType<typeof getAdminToolkitComponent>,
  player: GetPlayerDataRes | null | undefined,
) {
  if (!player) return false;

  const playerAddress = player.userId.toLowerCase();
  const isAdmin = sceneAdminsCache.find($ => $.address === playerAddress);

  return isAdmin || isPreview();
}

const uiComponent = (
  engine: IEngine,
  _pointerEventsSystem: PointerEventsSystem,
  _sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) => {
  const adminToolkitEntity = getAdminToolkitComponent(engine);
  const player = playersHelper?.getPlayer();
  const isPlayerAdmin = isAllowedAdmin(engine, adminToolkitEntity, player);
  const isMobile = detectIsMobile();

  // Mobile safe area (from Decentraland Building-for-Mobile guide):
  //   RED (unsafe) zones:
  //   - Left 25%  (full height)  → Chat, Search, Profile, Joystick, Emotes
  //   - Top-right  25% × 23%    → Profile access, camera controllers
  //   - Bottom-right 25% × 55%  → Interaction buttons
  //   GREEN (safe) zone = CENTER of screen

  // Desktop: row layout, anchored top-right (unchanged from original).
  // Mobile: row layout, anchored top-left inside the safe zone.
  const outerPosition = isMobile ? { top: 16, left: 300 } : { top: 120, right: 14 };
  const innerPosition = isMobile ? { left: 8, top: 2 } : { right: 8 };
  const toggleBtnSize = isMobile ? 54 : 42;

  return [
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        height: '100%',
        width: '100%',
      }}
    >
      {isPlayerAdmin ? (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            flexDirection: isMobile ? 'row-reverse' : 'row',
            position: outerPosition,
          }}
        >
          <UiEntity
            uiTransform={{
              display: state.panelOpen ? 'flex' : 'none',
              width: 400,
              pointerFilter: 'block',
              flexDirection: 'column',
              margin: innerPosition,
              borderRadius: RADIUS.xl,
              borderWidth: 1,
              borderColor: COLORS.divider,
              overflow: 'hidden',
            }}
            uiBackground={{ color: COLORS.panel }}
          >
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: {
                  left: SPACING.xxl,
                  right: SPACING.xxl,
                  top: SPACING.xl,
                  bottom: SPACING.xl,
                },
                borderColor: COLORS.divider,
              }}
            >
              <Label
                value="<b>Admin tools</b>"
                fontSize={TYPE.header}
                color={COLORS.textPrimary}
              />
              <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconTab
                  name="users"
                  active={state.activeTab === TabType.MODERATION_CONTROL}
                  enabled={adminToolkitEntity.moderationControl.isEnabled && !isPreview()}
                  onClick={() => setActiveTab(TabType.MODERATION_CONTROL)}
                />
                <IconTab
                  name="tv"
                  active={state.activeTab === TabType.VIDEO_CONTROL}
                  enabled={adminToolkitEntity.videoControl.isEnabled}
                  onClick={() => setActiveTab(TabType.VIDEO_CONTROL)}
                />
                <IconTab
                  name="bolt"
                  active={state.activeTab === TabType.SMART_ITEMS_CONTROL}
                  enabled={adminToolkitEntity.smartItemsControl.isEnabled}
                  onClick={() => setActiveTab(TabType.SMART_ITEMS_CONTROL)}
                />
                <IconTab
                  name="message"
                  active={state.activeTab === TabType.TEXT_ANNOUNCEMENT_CONTROL}
                  enabled={adminToolkitEntity.textAnnouncementControl.isEnabled}
                  onClick={() => setActiveTab(TabType.TEXT_ANNOUNCEMENT_CONTROL)}
                />
              </UiEntity>
            </UiEntity>
            <Divider />
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'column',
                // Mobile: cap the tab content to the viewport and scroll the
                // overflow, so tall tabs (e.g. permissions) stay fully reachable.
                // The header above stays fixed; desktop is left untouched.
                maxHeight: isMobile ? '85vh' : undefined,
                overflow: isMobile ? 'scroll' : 'visible',
              }}
            >
              {state.activeTab === TabType.TEXT_ANNOUNCEMENT_CONTROL ? (
                <TextAnnouncementsControl
                  engine={engine}
                  state={state}
                  player={player}
                />
              ) : null}
              {state.activeTab === TabType.VIDEO_CONTROL ? (
                <VideoControl
                  engine={engine}
                  state={state}
                  playerAddress={player?.userId}
                />
              ) : null}
              {state.activeTab === TabType.SMART_ITEMS_CONTROL ? (
                <SmartItemsControl
                  engine={engine}
                  state={state}
                />
              ) : null}
              {state.activeTab === TabType.MODERATION_CONTROL && (
                <ModerationControl
                  engine={engine}
                  player={player}
                  sceneAdmins={sceneAdminsCache}
                />
              )}
            </UiEntity>
          </UiEntity>
          <UiEntity
            uiTransform={{
              display: 'flex',
              height: toggleBtnSize,
              width: toggleBtnSize,
              alignItems: 'center',
              alignContent: 'center',
              justifyContent: 'center',
              pointerFilter: 'block',
            }}
            uiBackground={{
              texture: {
                src: ADMIN_ICONS.BTN_ADMIN_TOOLKIT_BACKGROUND,
              },
              textureMode: 'stretch',
              color: Color4.create(1, 1, 1, 1),
            }}
          >
            <DCLButton
              value=""
              uiTransform={{
                height: toggleBtnSize - 2,
                width: toggleBtnSize - 2,
                alignItems: 'center',
                alignContent: 'center',
                justifyContent: 'center',
              }}
              uiBackground={{
                texture: {
                  src: ADMIN_ICONS.BTN_ADMIN_TOOLKIT_CONTROL,
                },
                textureMode: 'stretch',
                color: Color4.create(1, 1, 1, 1),
              }}
              onMouseDown={() => togglePanel()}
            />
          </UiEntity>
        </UiEntity>
      ) : null}
      <TextAnnouncements
        engine={engine}
        state={state}
      />
    </UiEntity>,
    state.moderationControl.showModalAdminList && (
      <ModalUserList
        users={sceneAdminsCache ?? []}
        engine={engine}
        type={UserListType.ADMIN}
      />
    ),
    state.moderationControl.showModalBanList && (
      <ModalUserList
        users={sceneBansCache ?? []}
        engine={engine}
        type={UserListType.BAN}
      />
    ),
    state.videoControl.showcase.show &&
      state.videoControl.showcase.onSelectTrack &&
      state.videoControl.showcase.onSetDefault &&
      state.videoControl.showcase.onClose && (
        <SpeakerShowcase
          participants={state.videoControl.participants}
          activeTrackSid={state.videoControl.showcase.activeTrackSid}
          onSelectTrack={state.videoControl.showcase.onSelectTrack}
          onSetDefault={state.videoControl.showcase.onSetDefault}
          onClose={state.videoControl.showcase.onClose}
        />
      ),
    state.videoControl.sharePresentation.show && state.videoControl.sharePresentation.onClose && (
      <SharePresentationModal
        onClose={state.videoControl.sharePresentation.onClose}
        streamingKey={state.videoControl.dclCast?.streamingKey ?? ''}
      />
    ),
  ];
};
