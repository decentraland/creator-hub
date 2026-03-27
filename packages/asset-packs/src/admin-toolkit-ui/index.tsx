import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Label, Button as DCLButton, UiEntity, ReactBasedUiSystem } from '@dcl/react-ecs';
import { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import { getExplorerInformation } from '~system/Runtime';
import { getComponents, GetPlayerDataRes, IPlayersHelper, ISDKHelpers } from '../definitions';
import { VideoControl } from './VideoControl';
import { TextAnnouncementsControl } from './TextAnnouncementsControl';
import { SmartItemsControl } from './SmartItemsControl';
import { Button } from './Button';
import { TextAnnouncements } from './TextAnnouncements';
import { CONTENT_URL } from './constants';
import { State, TabType, SelectedSmartItem } from './types';
import {
  BTN_MODERATION_CONTROL,
  ModerationControl,
  moderationControlState,
  SceneAdmin,
} from './ModerationControl';
import { getSceneAdmins, getSceneBans, SceneBanUser } from './ModerationControl/api';
import { ModalUserList, UserListType } from './ModerationControl/UsersList';
import { isPreview } from './fetch-utils';

export const nextTickFunctions: (() => void)[] = [];
const ADMIN_TOOLKIT_VIRTUAL_UI_SIZE = { virtualWidth: 1920, virtualHeight: 1080 };

export let state: State = {
  adminToolkitUiEntity: 0 as Entity,
  panelOpen: false,
  activeTab: TabType.NONE,
  videoControl: {
    selectedVideoPlayer: undefined,
    selectedStream: undefined,
    dclCast: undefined,
  },
  smartItemsControl: {
    selectedSmartItem: undefined,
    smartItems: new Map<Entity, SelectedSmartItem>(),
  },
  textAnnouncementControl: {
    entity: undefined,
    text: undefined,
    messageRateTracker: new Map<string, number>(),
    announcements: [],
    maxAnnouncements: 4,
  },
  rewardsControl: {
    selectedRewardItem: undefined,
  },
};

let sceneAdminsCache: SceneAdmin[] = [];
let sceneBansCache: SceneBanUser[] = [];

// const BTN_REWARDS_CONTROL = `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-rewards-control-button.png`
// const BTN_REWARDS_CONTROL_ACTIVE = `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-rewards-control-active-button.png`

const BTN_VIDEO_CONTROL = `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-video-control-button.png`;

const BTN_SMART_ITEM_CONTROL = `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-smart-item-control-button.png`;

const BTN_TEXT_ANNOUNCEMENT_CONTROL = `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-text-announcement-control-button.png`;

const BTN_ADMIN_TOOLKIT_CONTROL = `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-control-button.png`;
const BTN_ADMIN_TOOLKIT_BACKGROUND = `${CONTENT_URL}/admin_toolkit/assets/backgrounds/admin-tool-background.png`;

export const containerBackgroundColor = Color4.create(0, 0, 0, 0.75);

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
    // user doesnt have permissions
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

function getRewards(engine: IEngine) {
  const adminToolkitComponent = getAdminToolkitComponent(engine);

  return Array.from(adminToolkitComponent?.rewardsControl?.rewardItems ?? []);
}

function initTextAnnouncementSync(engine: IEngine) {
  const { TextAnnouncements } = getComponents(engine);

  TextAnnouncements.createOrReplace(state.adminToolkitUiEntity, {
    text: '',
    author: '',
    id: '',
  });
}

// Initialize admin data before UI rendering
let adminDataInitialized = false;
export async function initializeAdminData(engine: IEngine, sdkHelpers?: ISDKHelpers) {
  if (!adminDataInitialized) {
    const { TextAnnouncements, VideoControlState } = getComponents(engine);

    // Initialize AdminToolkitUiEntity
    state.adminToolkitUiEntity = getAdminToolkitEntity(engine) ?? engine.addEntity();

    // Initialize TextAnnouncements sync component
    initTextAnnouncementSync(engine);

    // // Initialize Rewards sync
    // initRewardsSync(engine, sdkHelpers)

    if (!VideoControlState.getOrNull(state.adminToolkitUiEntity)) {
      VideoControlState.create(state.adminToolkitUiEntity);
    }

    sdkHelpers?.syncEntity?.(
      state.adminToolkitUiEntity,
      [VideoControlState.componentId, TextAnnouncements.componentId],
      ADMIN_TOOLS_ENTITY,
    );

    engine.addSystem(() => {
      if (nextTickFunctions.length > 0) {
        const nextTick = nextTickFunctions.shift();
        if (nextTick) {
          nextTick();
        }
      }
    }, Number.POSITIVE_INFINITY);

    // Initialize scene data
    await Promise.all([fetchSceneAdmins(), fetchSceneBans()]);

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
  // Initialize admin data before setting up the UI
  initializeAdminData(engine, sdkHelpers).then(() => {
    console.log('createAdminToolkitUI - initialized');
    reactBasedUiSystem.setUiRenderer(
      () => uiComponent(engine, pointerEventsSystem, sdkHelpers, playersHelper),
      ADMIN_TOOLKIT_VIRTUAL_UI_SIZE,
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

/**
 * Mobile detection using the recommended SDK approach (see Decentraland Building-for-Mobile guide).
 * Uses `getExplorerInformation` from `~system/Runtime` to query the actual platform
 * reported by the explorer client ('mobile' | 'desktop' | 'web').
 * Resolved once at startup and cached — same pattern as `isMobile()` from `@dcl/sdk/platform`.
 */
let _isMobile: boolean = false;
void getExplorerInformation({})
  .then((info) => {
    _isMobile = info.platform?.toLowerCase() === 'mobile';
  })
  .catch((err) => {
    console.error('Admin Tools: failed to detect platform:', err);
  });

const uiComponent = (
  engine: IEngine,
  pointerEventsSystem: PointerEventsSystem,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) => {
  const adminToolkitEntity = getAdminToolkitComponent(engine);
  const player = playersHelper?.getPlayer();
  const isPlayerAdmin = isAllowedAdmin(engine, adminToolkitEntity, player);
  const isMobile = _isMobile;

  // Mobile safe area (from Decentraland Building-for-Mobile guide):
  //   RED (unsafe) zones:
  //   - Left 25%  (full height)  → Chat, Search, Profile, Joystick, Emotes
  //   - Top-right  25% × 23%    → Profile access, camera controllers
  //   - Bottom-right 25% × 55%  → Interaction buttons
  //   GREEN (safe) zone = CENTER of screen
  //
  // Guide recommendations applied here:
  //   - "Put all actionable dialogues at center of screen"
  //   - "Ensure critical UI is inside the safe area"
  //   - "Scale up UI sizes by 3× for Mobile to improve readability"
  //
  // Mobile layout: toggle + panel centered horizontally in the safe zone,
  // toggle on top, panel expanding downward (column-reverse since toggle is last child).
  // Desktop layout: completely unchanged — panel + toggle side-by-side at top-right.

  const toggleBtnSize = isMobile ? 126 : 42;   // 42 × 3 = 126
  const tabBtnWidth = isMobile ? 147 : 49;     // 49 × 3 = 147
  const tabBtnHeight = isMobile ? 126 : 42;    // 42 × 3 = 126
  const panelWidth = isMobile ? 900 : 500;     // fits within center safe zone (~50% of 1920)
  const headerHeight = isMobile ? 150 : 50;    // 50 × 3 = 150
  const fontSize = isMobile ? 60 : 20;         // 20 × 3 = 60

  // Desktop: row layout, anchored top-right (unchanged from original).
  // Mobile: column-reverse layout, centered horizontally at top of safe zone.
  //   top: 60 clears the OS status bar / notch.
  //   left: centers the panel in the 1920-wide virtual canvas.
  //   column-reverse: toggle (last child) renders on top, panel expands below it.
  const outerPosition = isMobile
    ? { top: 60, left: Math.round((ADMIN_TOOLKIT_VIRTUAL_UI_SIZE.virtualWidth - panelWidth) / 2) }
    : { top: 120, right: 10 };

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
            flexDirection: isMobile ? 'column-reverse' : 'row',
            alignItems: isMobile ? 'center' : undefined,
            position: outerPosition,
          }}
        >
          <UiEntity
            uiTransform={{
              display: state.panelOpen ? 'flex' : 'none',
              width: panelWidth,
              pointerFilter: 'block',
              flexDirection: 'column',
              margin: isMobile ? { top: 8 } : { right: 8 },
            }}
          >
            <UiEntity
              uiTransform={{
                width: '100%',
                height: headerHeight,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 12,
                padding: {
                  left: 12,
                  right: 12,
                },
              }}
              uiBackground={{ color: containerBackgroundColor }}
            >
              <Label
                value="ADMIN TOOLS"
                fontSize={fontSize}
                color={Color4.create(160, 155, 168, 1)}
                uiTransform={{ flexGrow: 1 }}
              />
              <Button
                id="admin_toolkit_moderation_control"
                variant={state.activeTab === TabType.MODERATION_CONTROL ? 'primary' : 'text'}
                icon={BTN_MODERATION_CONTROL}
                onlyIcon
                uiTransform={{
                  display:
                    adminToolkitEntity.moderationControl.isEnabled && !isPreview()
                      ? 'flex'
                      : 'none',
                  width: tabBtnWidth,
                  height: tabBtnHeight,
                  margin: { right: 8 },
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                iconBackground={{
                  color:
                    state.activeTab === TabType.MODERATION_CONTROL
                      ? Color4.Black()
                      : Color4.White(),
                }}
                iconTransform={{ height: '100%', width: '100%' }}
                onMouseDown={() => {
                  if (state.activeTab !== TabType.MODERATION_CONTROL) {
                    state.activeTab = TabType.NONE;
                    nextTickFunctions.push(() => {
                      state.activeTab = TabType.MODERATION_CONTROL;
                    });
                  } else {
                    state.activeTab = TabType.NONE;
                  }
                }}
              />
              <Button
                id="admin_toolkit_panel_video_control"
                variant={state.activeTab === TabType.VIDEO_CONTROL ? 'primary' : 'text'}
                icon={BTN_VIDEO_CONTROL}
                iconBackground={{
                  color:
                    state.activeTab === TabType.VIDEO_CONTROL ? Color4.Black() : Color4.White(),
                }}
                onlyIcon
                uiTransform={{
                  display: adminToolkitEntity.videoControl.isEnabled ? 'flex' : 'none',
                  width: tabBtnWidth,
                  height: tabBtnHeight,
                  margin: { right: 8 },
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                iconTransform={{
                  height: '100%',
                  width: '100%',
                }}
                onMouseDown={() => {
                  if (state.activeTab !== TabType.VIDEO_CONTROL) {
                    state.activeTab = TabType.NONE;
                    nextTickFunctions.push(() => {
                      state.activeTab = TabType.VIDEO_CONTROL;
                    });
                  } else {
                    state.activeTab = TabType.NONE;
                  }
                }}
              />
              <Button
                id="admin_toolkit_panel_smart_items_control"
                variant={state.activeTab === TabType.SMART_ITEMS_CONTROL ? 'primary' : 'text'}
                icon={BTN_SMART_ITEM_CONTROL}
                iconBackground={{
                  color:
                    state.activeTab === TabType.SMART_ITEMS_CONTROL
                      ? Color4.Black()
                      : Color4.White(),
                }}
                onlyIcon
                uiTransform={{
                  display: adminToolkitEntity.smartItemsControl.isEnabled ? 'flex' : 'none',
                  width: tabBtnWidth,
                  height: tabBtnHeight,
                  margin: { right: 8 },
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                iconTransform={{
                  height: '100%',
                  width: '100%',
                }}
                onMouseDown={() => {
                  if (state.activeTab !== TabType.SMART_ITEMS_CONTROL) {
                    state.activeTab = TabType.NONE;
                    nextTickFunctions.push(() => {
                      state.activeTab = TabType.SMART_ITEMS_CONTROL;
                    });
                  } else {
                    state.activeTab = TabType.NONE;
                  }
                }}
              />
              <Button
                id="admin_toolkit_panel_text_announcement_control"
                variant={state.activeTab === TabType.TEXT_ANNOUNCEMENT_CONTROL ? 'primary' : 'text'}
                icon={BTN_TEXT_ANNOUNCEMENT_CONTROL}
                iconBackground={{
                  color:
                    state.activeTab === TabType.TEXT_ANNOUNCEMENT_CONTROL
                      ? Color4.Black()
                      : Color4.White(),
                }}
                onlyIcon
                uiTransform={{
                  display: adminToolkitEntity.textAnnouncementControl.isEnabled ? 'flex' : 'none',
                  width: tabBtnWidth,
                  height: tabBtnHeight,
                  margin: { right: 8 },
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                iconTransform={{
                  height: '100%',
                  width: '100%',
                }}
                onMouseDown={() => {
                  if (state.activeTab !== TabType.TEXT_ANNOUNCEMENT_CONTROL) {
                    state.activeTab = TabType.NONE;
                    nextTickFunctions.push(() => {
                      state.activeTab = TabType.TEXT_ANNOUNCEMENT_CONTROL;
                    });
                  } else {
                    state.activeTab = TabType.NONE;
                  }
                }}
              />
            </UiEntity>
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
                src: BTN_ADMIN_TOOLKIT_BACKGROUND,
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
                  src: BTN_ADMIN_TOOLKIT_CONTROL,
                },
                textureMode: 'stretch',
                color: Color4.create(1, 1, 1, 1),
              }}
              onMouseDown={() => {
                state.panelOpen = !state.panelOpen;
              }}
            />
          </UiEntity>
        </UiEntity>
      ) : null}
      <TextAnnouncements
        engine={engine}
        state={state}
      />
    </UiEntity>,
    moderationControlState.showModalAdminList && (
      <ModalUserList
        users={sceneAdminsCache ?? []}
        engine={engine}
        type={UserListType.ADMIN}
      />
    ),
    moderationControlState.showModalBanList && (
      <ModalUserList
        users={sceneBansCache ?? []}
        engine={engine}
        type={UserListType.BAN}
      />
    ),
  ];
};
