import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Label, Button as DCLButton, UiEntity, ReactBasedUiSystem } from '@dcl/react-ecs';
import { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import { getComponents, GetPlayerDataRes, IPlayersHelper, ISDKHelpers } from '../definitions';
import { getScaleUIFactor } from '../ui';
import { VideoControl } from './VideoControl';
import { TextAnnouncementsControl } from './TextAnnouncementsControl';
import { SmartItemsControl } from './SmartItemsControl';
import { Button } from './Button';
import { TextAnnouncements } from './TextAnnouncements';
import { LogsControl } from './LogsControl';
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
export let scaleFactor: number;
const VIDEO_CONTROL_HYDRATION_GUARD_MS = 3000;
const VIDEO_CONTROL_HYDRATION_POLL_MS = 100;

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
  logs: [],
};

let sceneAdminsCache: SceneAdmin[] = [];
let sceneBansCache: SceneBanUser[] = [];

function sleep(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

async function waitForVideoControlStateHydration(engine: IEngine, timeoutMs: number) {
  const { VideoControlState } = getComponents(engine);
  const start = Date.now();

  pushLog(
    `[video-hydration] waiting for VideoControlState (entity=${state.adminToolkitUiEntity}) up to ${timeoutMs}ms`,
  );

  while (Date.now() - start < timeoutMs) {
    if (VideoControlState.getOrNull(state.adminToolkitUiEntity)) {
      pushLog(
        `[video-hydration] VideoControlState found after ${Date.now() - start}ms for entity=${state.adminToolkitUiEntity}`,
      );
      return true;
    }

    await sleep(VIDEO_CONTROL_HYDRATION_POLL_MS);
  }

  pushLog(
    `[video-hydration] timeout after ${Date.now() - start}ms waiting for VideoControlState for entity=${state.adminToolkitUiEntity}`,
  );

  return false;
}

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

let initPromise: Promise<void> | null = null;
export function initializeAdminData(engine: IEngine, sdkHelpers?: ISDKHelpers) {
  if (!initPromise) {
    initPromise = doInitializeAdminData(engine, sdkHelpers);
  }
  return initPromise;
}

export function pushLog(...args: any[]) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  state.logs.push(msg);
  console.log(...args);
}

async function doInitializeAdminData(engine: IEngine, sdkHelpers?: ISDKHelpers) {
  pushLog('🔧 running asset packs local version');
  const { TextAnnouncements, VideoControlState } = getComponents(engine);
  const existingAdminToolkitEntity = getAdminToolkitEntity(engine);
  state.adminToolkitUiEntity = existingAdminToolkitEntity ?? engine.addEntity();
  pushLog(
    `[admin-init] adminToolkitUiEntity set to ${state.adminToolkitUiEntity} (existing=${existingAdminToolkitEntity}, created=${existingAdminToolkitEntity ? 'no' : 'yes'})`,
  );
  pushLog(
    `[admin-init] sdkHelpers present: ${!!sdkHelpers}, has syncEntity: ${!!sdkHelpers?.syncEntity}`,
  );
  if (sdkHelpers) {
    pushLog(
      '[admin-init] sdkHelpers snapshot:',
      JSON.stringify({
        keys: Object.keys(sdkHelpers),
        hasSyncEntity: !!sdkHelpers.syncEntity,
      }),
    );
  } else {
    pushLog('[admin-init] sdkHelpers is null/undefined');
  }
  initTextAnnouncementSync(engine);

  // Register sync BEFORE hydration wait so replicated state can arrive
  pushLog('[admin-init] registering syncEntity...');
  sdkHelpers?.syncEntity?.(
    state.adminToolkitUiEntity,
    [VideoControlState.componentId, TextAnnouncements.componentId],
    ADMIN_TOOLS_ENTITY,
  );
  pushLog(
    `[admin-init] syncEntity registered. Waiting up to ${VIDEO_CONTROL_HYDRATION_GUARD_MS}ms for hydration...`,
  );

  const hydrated = await waitForVideoControlStateHydration(
    engine,
    VIDEO_CONTROL_HYDRATION_GUARD_MS,
  );

  const existingState = VideoControlState.getOrNull(state.adminToolkitUiEntity);
  if (hydrated) {
    pushLog(
      `[admin-init] ✅ hydration SUCCESS — VideoControlState received from network:`,
      JSON.stringify(existingState),
    );
  } else if (existingState) {
    pushLog(
      `[admin-init] ⏱️ hydration timed out but VideoControlState already exists:`,
      JSON.stringify(existingState),
    );
  } else {
    pushLog(
      '[admin-init] ⚠️ hydration timed out, no VideoControlState found — creating fresh default',
    );
    VideoControlState.create(state.adminToolkitUiEntity);
    pushLog(
      '[admin-init] fresh VideoControlState created:',
      JSON.stringify(VideoControlState.getOrNull(state.adminToolkitUiEntity)),
    );
  }

  engine.addSystem(() => {
    if (nextTickFunctions.length > 0) {
      const nextTick = nextTickFunctions.shift();
      if (nextTick) {
        nextTick();
      }
    }
  }, Number.POSITIVE_INFINITY);

  pushLog('[admin-init] fetching scene admins and bans...');
  await Promise.all([fetchSceneAdmins(), fetchSceneBans()]);

  pushLog('[admin-init] ✅ fully initialized');
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
    reactBasedUiSystem.setUiRenderer(() =>
      uiComponent(engine, pointerEventsSystem, sdkHelpers, playersHelper),
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
  pointerEventsSystem: PointerEventsSystem,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) => {
  const adminToolkitEntity = getAdminToolkitComponent(engine);
  const player = playersHelper?.getPlayer();
  const isPlayerAdmin = isAllowedAdmin(engine, adminToolkitEntity, player);
  scaleFactor = getScaleUIFactor(engine);

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
            flexDirection: 'row',
            position: { top: 120 * scaleFactor, right: 10 * scaleFactor },
          }}
        >
          <UiEntity
            uiTransform={{
              display: state.panelOpen ? 'flex' : 'none',
              width: 500 * scaleFactor,
              pointerFilter: 'block',
              flexDirection: 'column',
              margin: { right: 8 * scaleFactor },
            }}
          >
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 50 * scaleFactor,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 12 * scaleFactor,
                padding: {
                  left: 12 * scaleFactor,
                  right: 12 * scaleFactor,
                },
              }}
              uiBackground={{ color: containerBackgroundColor }}
            >
              <Label
                value="ADMIN TOOLS (LOCAL ALE)"
                fontSize={20 * scaleFactor}
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
                  width: 49 * scaleFactor,
                  height: 42 * scaleFactor,
                  margin: { right: 8 * scaleFactor },
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
                  width: 49 * scaleFactor,
                  height: 42 * scaleFactor,
                  margin: { right: 8 * scaleFactor },
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
                  width: 49 * scaleFactor,
                  height: 42 * scaleFactor,
                  margin: { right: 8 * scaleFactor },
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
                  width: 49 * scaleFactor,
                  height: 42 * scaleFactor,
                  margin: { right: 8 * scaleFactor },
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
              <Button
                id="admin_toolkit_panel_logs_control"
                variant={state.activeTab === TabType.LOGS_CONTROL ? 'primary' : 'text'}
                value="Logs"
                fontSize={12 * scaleFactor}
                color={state.activeTab === TabType.LOGS_CONTROL ? Color4.Black() : Color4.White()}
                onlyIcon={false}
                uiTransform={{
                  display: 'flex',
                  width: 49 * scaleFactor,
                  height: 42 * scaleFactor,
                  margin: { right: 8 * scaleFactor },
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseDown={() => {
                  if (state.activeTab !== TabType.LOGS_CONTROL) {
                    state.activeTab = TabType.NONE;
                    nextTickFunctions.push(() => {
                      state.activeTab = TabType.LOGS_CONTROL;
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
            {state.activeTab === TabType.LOGS_CONTROL && (
              <LogsControl
                engine={engine}
                state={state}
              />
            )}
          </UiEntity>
          <UiEntity
            uiTransform={{
              display: 'flex',
              height: 42 * scaleFactor,
              width: 42 * scaleFactor,
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
                height: 40 * scaleFactor,
                width: 40 * scaleFactor,
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
        scaleFactor={scaleFactor}
        users={sceneAdminsCache ?? []}
        engine={engine}
        type={UserListType.ADMIN}
      />
    ),
    moderationControlState.showModalBanList && (
      <ModalUserList
        scaleFactor={scaleFactor}
        users={sceneBansCache ?? []}
        engine={engine}
        type={UserListType.BAN}
      />
    ),
  ];
};
