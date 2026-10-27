/** @jsx ReactEcs.createElement */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is required for the JSX factory
import ReactEcs, { Label, Button as DCLButton, UiEntity } from '@dcl/sdk/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { isMobile } from '@dcl/sdk/platform';
import type { IEngine, PointerEventsSystem } from '@dcl/sdk/ecs';
import type { ISDKHelpers, IPlayersHelper } from '@dcl/asset-packs/dist/definitions';
import {
  state,
  COLORS,
  RADIUS,
  SPACING,
  TYPE,
  TabType,
  IconTab,
  Divider,
  setActiveTab,
  togglePanel,
  isPreview,
  getContentUrl,
  getAdminConfig,
  isAllowedAdmin,
  getSceneAdminsCache,
  getSceneBansCache,
  VideoControl,
  ModerationControl,
  SmartItemsControl,
  TextAnnouncementsControl,
  TextAnnouncements,
  SpeakerShowcase,
  SharePresentationModal,
  ModalUserList,
  UserListType,
} from '@dcl/asset-packs/dist/admin-toolkit-ui/panel-api';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EDITABLE ADMIN PANEL
//
// This is the in-world admin panel's layout. It's plain @dcl/react-ecs and yours to change: add a
// tab, rearrange the header, drop in clickable links, rebrand it. The heavy tab contents
// (moderation, video, smart items, announcements) and the backend come from @dcl/asset-packs, so
// you only edit the shell here. `AdminTools.ts` passes this to `createAdminToolkitUI`.
//
// Example — add a link button in the header (import openExternalUrl from '~system/RestrictedActions'):
//   <DCLButton value="Docs" onMouseDown={() => openExternalUrl({ url: 'https://decentraland.org' })} />
// ─────────────────────────────────────────────────────────────────────────────────────────────

const ADMIN_ICONS = {
  get control() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/admin-panel-control-button.png`;
  },
  get background() {
    return `${getContentUrl()}/admin_toolkit/assets/backgrounds/admin-tool-background.png`;
  },
};

export function renderAdminPanel(
  engine: IEngine,
  _pointerEventsSystem: PointerEventsSystem,
  _sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  const config = getAdminConfig(engine);
  const player = playersHelper?.getPlayer();
  const isPlayerAdmin = isAllowedAdmin(engine, config, player);

  // Desktop: row layout anchored top-right. Mobile: anchored top-left inside the safe zone.
  const outerPosition = isMobile() ? { top: 16, left: 300 } : { top: 120, right: 14 };
  const innerPosition = isMobile() ? { left: 8, top: 2 } : { right: 8 };
  const toggleBtnSize = isMobile() ? 54 : 42;

  return [
    <UiEntity uiTransform={{ positionType: 'absolute', height: '100%', width: '100%' }}>
      {isPlayerAdmin ? (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            flexDirection: isMobile() ? 'row-reverse' : 'row',
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
                  enabled={config.moderationControl.isEnabled && !isPreview()}
                  onClick={() => setActiveTab(TabType.MODERATION_CONTROL)}
                />
                <IconTab
                  name="tv"
                  active={state.activeTab === TabType.VIDEO_CONTROL}
                  enabled={config.videoControl.isEnabled}
                  onClick={() => setActiveTab(TabType.VIDEO_CONTROL)}
                />
                <IconTab
                  name="bolt"
                  active={state.activeTab === TabType.SMART_ITEMS_CONTROL}
                  enabled={config.smartItemsControl.isEnabled}
                  onClick={() => setActiveTab(TabType.SMART_ITEMS_CONTROL)}
                />
                <IconTab
                  name="message"
                  active={state.activeTab === TabType.TEXT_ANNOUNCEMENT_CONTROL}
                  enabled={config.textAnnouncementControl.isEnabled}
                  onClick={() => setActiveTab(TabType.TEXT_ANNOUNCEMENT_CONTROL)}
                />
              </UiEntity>
            </UiEntity>
            <Divider />
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'column',
                maxHeight: isMobile() ? '85vh' : undefined,
                overflow: isMobile() ? 'scroll' : 'visible',
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
                  sceneAdmins={getSceneAdminsCache()}
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
              texture: { src: ADMIN_ICONS.background },
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
                texture: { src: ADMIN_ICONS.control },
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
        users={getSceneAdminsCache() ?? []}
        engine={engine}
        type={UserListType.ADMIN}
      />
    ),
    state.moderationControl.showModalBanList && (
      <ModalUserList
        users={getSceneBansCache() ?? []}
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
}
