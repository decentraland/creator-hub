import type { Entity } from '@dcl/sdk/ecs';
import {
  Animator,
  AudioSource,
  engine,
  Material,
  MaterialTransparencyMode,
  Name,
  TextureWrapMode,
  Transform,
  TriggerArea,
  triggerAreaEventsSystem,
} from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';
import { getPlayer } from '@dcl/sdk/src/players';
import type { ActionCallback } from '~sdk/script-utils';

export class WearableScanner {
  private scanning: boolean = false;
  private imageEntity: Entity | null = null;

  /**
   * Trims URN by removing token ID if present
   * Keeps only collection and asset id parts
   * Example: urn:decentraland:matic:collections-v2:0x...:3:tokenId -> urn:decentraland:matic:collections-v2:0x...:3
   */
  private trimUrn(urn: string): string {
    // Match URN pattern and capture up to asset id, excluding token id if present
    // Pattern: urn:decentraland:...:collection:assetId:tokenId (tokenId is optional)
    const match = urn.match(/^(urn:decentraland:[^:]+:[^:]+:[^:]+:[^:]+)(?::[^:]+)?$/);
    return match ? match[1] : urn;
  }

  constructor(
    public src: string,
    public entity: Entity,
    public wearableId: string,
    public activatedEntity: ActionCallback,
  ) {
    // Trim the wearableId URN in constructor
    this.wearableId = this.trimUrn(wearableId);
    // Find the image child entity
    this.imageEntity = this.findImageEntity();
  }

  /**
   * Finds the image child entity by checking children of the main entity
   * Validates that there's only one child with a name starting with "Wearable-thumbnail"
   * @returns The image entity, or null if not found or multiple found
   */
  private findImageEntity(): Entity | null {
    const imageEntities: Entity[] = [];

    // Iterate through all entities with Transform to find children
    for (const [childEntity, transform] of engine.getEntitiesWith(Transform)) {
      // Check if this entity is a child of our main entity
      if (transform.parent === this.entity) {
        // Check if this child has a Name component that starts with "Wearable-thumbnail"
        const nameComponent = Name.getOrNull(childEntity);
        if (nameComponent && nameComponent.value.startsWith('Wearable-thumbnail')) {
          imageEntities.push(childEntity);
        }
      }
    }

    // Validate that we found exactly one image entity
    if (imageEntities.length === 0) {
      console.error(
        'WearableScanner: No child entity found with name starting with "Wearable-thumbnail"',
      );
      return null;
    } else if (imageEntities.length > 1) {
      console.error(
        `WearableScanner: Multiple children found with name starting with "Wearable-thumbnail" (found ${imageEntities.length}). Expected exactly one.`,
      );
      return null;
    }

    return imageEntities[0];
  }

  /**
   * Start function - called when the script is initialized
   */
  async start() {
    // Script initialization
    console.log('WearableScanner initialized for entity:', this.entity);

    if (this.imageEntity) {
      const url = `https://peer.decentraland.org/lambdas/collections/contents/${this.wearableId.toLowerCase()}/thumbnail`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        console.log('WearableScanner imageEntity:', data);
      } catch (e) {
        console.log('WearableScanner imageEntity:', url);
      }

      console.log('WearableScanner imageEntity:', url);

      Material.setPbrMaterial(this.imageEntity, {
        texture: Material.Texture.Common({
          src: url,
          wrapMode: TextureWrapMode.TWM_CLAMP,
        }),
        castShadows: false,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
        specularIntensity: 0,
        metallic: 0,
      });
    } else {
      console.log('WearableScanner: Image entity not found, thumbnail will not be displayed');
    }

    Animator.playSingleAnimation(this.entity, 'NotAllow_Action', true);

    const trigger = engine.addEntity();
    Transform.create(trigger, {
      parent: this.entity,
      position: Vector3.create(0, 0, 1),
      scale: Vector3.create(2, 4, 3),
    });
    TriggerArea.setBox(trigger);

    triggerAreaEventsSystem.onTriggerEnter(trigger, () => {
      if (this.scanning) return;
      this.scanning = true;
      Animator.playSingleAnimation(this.entity, 'Laser_Action', true);
      AudioSource.createOrReplace(this.entity, {
        audioClipUrl: 'assets/scene/Audio/LaserHum.mp3',
        playing: true,
        loop: false,
      });

      // check wearables
      setTimeout(async () => {
        const accepted = await this.checkWearables(this.wearableId);
        if (accepted) {
          Animator.playSingleAnimation(this.entity, 'Allow_Action', true);
          AudioSource.createOrReplace(this.entity, {
            audioClipUrl: 'assets/scene/Audio/accept.mp3',
            playing: true,
            loop: false,
          });
          console.log('Access Granted');
          if (this.activatedEntity) {
            this.activatedEntity();
          }
        } else {
          Animator.playSingleAnimation(this.entity, 'NotAllow_Action', true);
          AudioSource.createOrReplace(this.entity, {
            audioClipUrl: 'assets/scene/Audio/access_denied.mp3',
            playing: true,
            loop: false,
          });
          console.log('Access Denied');
        }

        this.scanning = false;
      }, 4000);
    });
  }

  /**
   * Update function - called every frame
   * @param _dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    // Called every frame
  }

  async checkWearables(filter: string) {
    const playerData = getPlayer();

    if (!playerData || !playerData.wearables) return false;

    console.log('Currently wearing: ', playerData.wearables);
    let result = false;
    for (const wearable of playerData.wearables) {
      // Trim the wearable URN before comparison
      const trimmedWearable = this.trimUrn(wearable);
      if (trimmedWearable === filter) {
        result = true;
      }
    }

    return result;
  }
}

// Manage delays

// Timer system for handling delayed callbacks using delta time
interface TimerCallback {
  callback: () => void | Promise<void>;
  remainingTime: number;
}

const timerCallbacks: TimerCallback[] = [];

engine.addSystem((dt: number) => {
  for (let i = timerCallbacks.length - 1; i >= 0; i--) {
    const timer = timerCallbacks[i];
    timer.remainingTime -= dt;

    if (timer.remainingTime <= 0) {
      timer.callback();
      timerCallbacks.splice(i, 1);
    }
  }
});

function setTimeout(callback: () => void | Promise<void>, delayMs: number) {
  timerCallbacks.push({
    callback,
    remainingTime: delayMs / 1000, // Convert milliseconds to seconds
  });
}
