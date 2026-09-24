import { engine, pointerEventsSystem } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs';
import { syncEntity } from '@dcl/sdk/network';
import players from '@dcl/sdk/players';
import type { AdminTools as AdminConfig } from '@dcl/asset-packs/dist/definitions';
import { createAdminToolkitUI, setAdminConfig } from '@dcl/asset-packs/dist/admin-toolkit-ui';

export class AdminTools {
  /**
   * Adds an in-world admin panel to the scene. Admin users can play videos and streams,
   * trigger other smart items' actions, moderate players, and send scene-wide text
   * announcements. People with publish permissions are admins automatically; you can add
   * more after publishing.
   *
   * Every field below configures one section of the panel. The whole UI is plain
   * `@dcl/react-ecs`, imported from `@dcl/asset-packs`, so you can read and extend it.
   *
   * @param adminPermissions - Who is allowed to open the admin panel.
   * @param authorizedAdminUsers - Which groups (you, scene owners, an allow-list) count as admins.
   * @param moderationControl - Kick players and manage the admin allow-list.
   * @param textAnnouncementControl - Scene-wide text announcements.
   * @param videoControl - Video and stream screens the admin can control.
   * @param smartItemsControl - Other smart items whose actions the admin can trigger.
   * @param rewardsControl - Reward campaigns the admin can dispense.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public adminPermissions: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
    public authorizedAdminUsers: {
      me: boolean;
      sceneOwners: boolean;
      allowList: boolean;
      adminAllowList: string[];
    } = { me: true, sceneOwners: true, allowList: true, adminAllowList: [] },
    public moderationControl: {
      isEnabled: boolean;
      kickCoordinates: { x: number; y: number; z: number };
      allowNonOwnersManageAdminAllowList: boolean;
    } = {
      isEnabled: true,
      kickCoordinates: { x: 0, y: 0, z: 0 },
      allowNonOwnersManageAdminAllowList: false,
    },
    public textAnnouncementControl: {
      isEnabled: boolean;
      playSoundOnEachAnnouncement: boolean;
      showAuthorOnEachAnnouncement: boolean;
    } = { isEnabled: true, playSoundOnEachAnnouncement: true, showAuthorOnEachAnnouncement: true },
    public videoControl: {
      isEnabled: boolean;
      disableVideoPlayersSound: boolean;
      showAuthorOnVideoPlayers: boolean;
      linkAllVideoPlayers: boolean;
      videoPlayers: Array<{ entity: Entity; customName: string }>;
    } = {
      isEnabled: true,
      disableVideoPlayersSound: false,
      showAuthorOnVideoPlayers: true,
      linkAllVideoPlayers: false,
      videoPlayers: [],
    },
    public smartItemsControl: {
      isEnabled: boolean;
      linkAllSmartItems: boolean;
      smartItems: Array<{ entity: Entity; customName: string; defaultAction: string }>;
    } = { isEnabled: true, linkAllSmartItems: false, smartItems: [] },
    public rewardsControl: {
      isEnabled: boolean;
      rewardItems: Array<{ entity: Entity; customName: string }>;
    } = { isEnabled: true, rewardItems: [] },
  ) {}

  start() {
    // Feed the params into the shared admin UI, then mount it on the scene's own renderer.
    // The UI reads its config through `getAdminConfig`, which returns what we inject here (no
    // `asset-packs::AdminTools` component is created). The always-on legacy admin system finds
    // no such component and stays idle, so the panel mounts exactly once.
    //
    // NOTE: this smart item's composite keeps an `asset-packs::Placeholder`, which is what makes
    // the scene an "editor scene" so `@dcl/sdk-commands` bundles `initAssetPacks` — the thing that
    // registers the asset-pack components (VideoControlState, TextAnnouncements, …) the UI needs.
    setAdminConfig(this.buildConfig(), this.entity);
    createAdminToolkitUI(engine, pointerEventsSystem, ReactEcsRenderer, { syncEntity }, players);
  }

  private buildConfig(): AdminConfig {
    return {
      // The dropdown param is a string-literal union for the editor; the component's runtime
      // type is the AdminPermissions enum (same 'PUBLIC'/'PRIVATE' values).
      adminPermissions: this.adminPermissions as unknown as AdminConfig['adminPermissions'],
      authorizedAdminUsers: this.authorizedAdminUsers,
      moderationControl: this.moderationControl,
      textAnnouncementControl: this.textAnnouncementControl,
      videoControl: this.videoControl,
      smartItemsControl: this.smartItemsControl,
      rewardsControl: this.rewardsControl,
    };
  }
}
