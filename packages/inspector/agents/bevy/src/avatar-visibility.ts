import { engine, AvatarModifierArea, AvatarModifierType, Transform } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';

/**
 * Hide/show the player's avatar in the editor viewport.
 *
 * The engine has no console command for this, but it honours the SDK's
 * `AvatarModifierArea` with `AMT_HIDE_AVATARS` for the LOCAL player too
 * (bevy-explorer `manage_player_visibility` reads the same `PlayerModifiers.hide`
 * flag it computes for other players), and a portable scene's area counts
 * wherever the player stands (`ContainingScene::get_area` includes every
 * portable). As a system scene the agent needs no permission prompt for it. So
 * one world-sized area owned by the agent hides the avatar while it's not wanted;
 * removing it shows the avatar again. The inspector decides when (scene running,
 * or the user driving the player camera) and sends `set-avatar-visible`.
 *
 * The modifier also hides OTHER players inside the area; that only matters while
 * the editor sits frozen with the avatar hidden, and they return on Play.
 */

// Half the world on each axis — any position the player can reach is inside.
const WORLD_SPAN = 1_000_000;

let hideArea: Entity | null = null;

/** Show (`true`) or hide (`false`) the player's avatar. Idempotent. */
export function setAvatarVisible(visible: boolean): void {
  if (visible) {
    if (hideArea === null) return;
    engine.removeEntity(hideArea);
    hideArea = null;
    return;
  }
  if (hideArea !== null) return;
  hideArea = engine.addEntity();
  Transform.create(hideArea, { position: Vector3.Zero() });
  AvatarModifierArea.create(hideArea, {
    area: Vector3.create(WORLD_SPAN, WORLD_SPAN, WORLD_SPAN),
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
    excludeIds: [],
    useColliderRange: false,
  });
}
