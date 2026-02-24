import type { Entity, PBAvatarBase, PBAvatarEquippedData, TransformType } from '@dcl/ecs';
import { BaseComponentNames } from './constants';

export type AssetPackData = {
  id: string;
  name: string;
};

export function isAssetPackData(value: any): value is AssetPackData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  );
}

export type LegacyAssetData = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  components: Record<string, any>;
};

export type AssetComposite = {
  version: number;
  components: Array<{
    name: string;
    data: {
      [key: string]: {
        json: any;
      };
    };
  }>;
};

export type AssetData = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  composite: AssetComposite;
  description?: string;
  author?: string;
};

export type AssetDataWithoutComposite = Omit<AssetData, 'composite'>;

export interface TriggerData {
  value: {
    type: string;
    actions: {
      id: string;
      name: string;
    }[];
  }[];
}

export function isAssetDataWithoutComposite(value: any): value is AssetDataWithoutComposite {
  if ('composite' in value) {
    return false;
  }
  return (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'category' in value &&
    typeof value.category === 'string' &&
    'tags' in value &&
    Array.isArray(value.tags)
  );
}

export function isAssetData(value: any): value is AssetData {
  return (
    value &&
    typeof value === 'object' &&
    'composite' in value &&
    typeof value.composite === 'object' &&
    'version' in value.composite &&
    'components' in value.composite &&
    Array.isArray(value.composite.components)
  );
}

export function isLegacyAssetData(value: any): value is LegacyAssetData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.category === 'string' &&
    typeof value.components === 'object' &&
    value.components !== null
  );
}

export function getTriggerComponent(value: AssetData): TriggerData | undefined {
  return value.composite.components.find(c => c.name === BaseComponentNames.TRIGGERS)?.data[0]
    ?.json as TriggerData | undefined;
}

export function assertValidTriggerComponent(assetName: string, trigger: TriggerData) {
  trigger.value.forEach(({ type, actions }) => {
    actions.forEach(({ id, name }) => {
      if (!id || !name) {
        throw new Error(`Invalid actions found on "${assetName}" for trigger with type "${type}"`);
      }
    });
  });
}

export type Asset = AssetData & { contents: Record<string, string> };
export type AssetPack = AssetPackData & { thumbnail: string; assets: Asset[] };
export type Catalog = { assetPacks: AssetPack[] };

export type Component = {
  name: string;
  data: {
    [key: string]: {
      json: any;
    };
  };
};

export type ISDKHelpers = {
  // SyncEntity helper to create network entities at runtime.
  syncEntity?: SyncEntitySDK;
};

export type SyncEntitySDK = (
  entityId: Entity,
  componentIds: number[],
  entityEnumId?: number | undefined,
) => void;

export type IPlayersHelper = {
  onEnterScene(cb: (player: GetPlayerDataRes) => void): void;
  onLeaveScene(cb: (userId: string) => void): void;
  /**
   * Returns the info of the player if it's in the scene.
   */
  getPlayer(user?: GetPlayerDataReq): GetPlayerDataRes | null;
};

type GetPlayerDataReq = {
  userId: string;
};

export type GetPlayerDataRes = {
  entity: Entity;
  name: string;
  isGuest: boolean;
  userId: string;
  avatar?: PBAvatarBase;
  wearables: PBAvatarEquippedData['wearableUrns'];
  emotes: PBAvatarEquippedData['emoteUrns'];
  position: TransformType['position'] | undefined;
};

export type CaptchaData = {
  campaignId: string;
  dispenserKey: string;
  captcha: {
    id: string;
    image: string;
    height: number;
    width: number;
  };
};

/**
 * Reference to an action on an entity.
 * Used to store action references in script parameters.
 */
export type ActionRef = {
  entity: Entity;
  action: string;
};

/**
 * A callback function that triggers an action.
 * Scripts receive this as a parameter and can call it to trigger the referenced action.
 *
 * @example
 * ```typescript
 * export class Padlock {
 *   constructor(
 *     public src: string,
 *     public entity: Entity,
 *     public onUnlock: ActionCallback
 *   ) {}
 *
 *   solve() {
 *     this.onUnlock(); // Triggers the action selected in the editor
 *   }
 * }
 * ```
 */
export type ActionCallback = () => void;
