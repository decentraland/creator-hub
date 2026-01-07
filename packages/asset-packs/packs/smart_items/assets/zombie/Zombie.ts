import type { Entity } from '@dcl/sdk/ecs';
import {
  Animator,
  ColliderLayer,
  engine,
  PlayerIdentityData,
  raycastSystem,
  Schemas,
  Transform,
} from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import { getPlayer } from '@dcl/sdk/src/players';
import { syncEntity } from '@dcl/sdk/network';
import { getActionEvents } from '@dcl/asset-packs/dist/events';

type ZombieState = 'WANDER' | 'CHASE' | 'ATTACK';

// Custom component to store zombie state data (synced across players)
export const ZombieStateData = engine.defineComponent(
  'ZombieStateData',
  {
    currentState: Schemas.String,
    chasedPlayerId: Schemas.String,
    distanceToClosestPlayer: Schemas.Number,
  },
  {
    currentState: 'WANDER',
    chasedPlayerId: '',
    distanceToClosestPlayer: Infinity,
  },
);

const ATTACK_RANGE_METERS = 1;
const ATTACK_TRIGGER_RANGE_METERS = 1.5; // buffer so attack can trigger without collision
const ATTACK_COOLDOWN_SECONDS = 1.2;

export class Zombie {
  public wanderTarget: Vector3 | null = null;
  public timeUntilRetargetSeconds: number = 2 + Math.random() * 3; // 2-5s
  public attackCooldownSeconds: number = 0;
  public currentAnim: 'NONE' | 'WALK' | 'ATTACK' = 'NONE';
  public blockedAhead: boolean = false;
  public avoidanceTarget: Vector3 | null = null;
  public avoidRightNext: boolean = false;
  public currentPlayerId: string | null = null; // Current player's ID (set once in start())
  public attackActionTimer: number = 0; // Timer for executing attack action (once per second)

  // Helper getters/setters for synced state data
  get currentState(): ZombieState {
    const data = ZombieStateData.getOrNull(this.entity);
    return (data?.currentState as ZombieState) || 'WANDER';
  }

  set currentState(value: ZombieState) {
    const data = ZombieStateData.getMutable(this.entity);
    data.currentState = value;
  }

  get chasedPlayerId(): string | null {
    const data = ZombieStateData.getOrNull(this.entity);
    return data?.chasedPlayerId || null;
  }

  set chasedPlayerId(value: string | null) {
    const data = ZombieStateData.getMutable(this.entity);
    data.chasedPlayerId = value || '';
  }

  get distanceToClosestPlayer(): number {
    const data = ZombieStateData.getOrNull(this.entity);
    return data?.distanceToClosestPlayer ?? Infinity;
  }

  set distanceToClosestPlayer(value: number) {
    const data = ZombieStateData.getMutable(this.entity);
    data.distanceToClosestPlayer = value;
  }

  constructor(
    public src: string,
    public entity: Entity,

    public CHASE_RANGE_METERS: number = 20,
    public WANDER_RADIUS_METERS: number = 6,
    public WANDER_SPEED: number = 0.8,
    public CHASE_SPEED: number = 1.6,
    public OBSTACLE_CHECK_DISTANCE: number = 1.0,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // Create and initialize the synced state component
    ZombieStateData.create(this.entity, {
      currentState: 'WANDER',
      chasedPlayerId: '',
      distanceToClosestPlayer: Infinity,
    });

    // Sync the component across all players
    // Note: You'll need to provide a unique entityEnumId for each zombie
    // For now, using the entity number as ID (you may want to use a proper enum)
    syncEntity(
      this.entity,
      [ZombieStateData.componentId, Transform.componentId, Animator.componentId],
      this.entity as unknown as number,
    );
  }

  /**
   * Get current player ID (cached, but refreshed if null)
   */
  private getCurrentPlayerId(): string | null {
    if (!this.currentPlayerId) {
      const currentPlayer = getPlayer();
      this.currentPlayerId = currentPlayer?.userId || null;
    }
    return this.currentPlayerId;
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    if (!Transform.has(this.entity)) return;
    if (!Animator.has(this.entity)) return;

    const zTransform = Transform.getMutable(this.entity);
    const zombiePos = zTransform.position;

    // Update cooldowns
    if (this.attackCooldownSeconds > 0)
      this.attackCooldownSeconds = Math.max(0, this.attackCooldownSeconds - dt);

    // Get current player ID (refresh if needed)
    const currentPlayerId = this.getCurrentPlayerId();

    // Calculate distance to current player
    const currentPlayerPos = getPlayerPosition();
    const currentPlayerDistance = this.horizontalDistance(zombiePos, currentPlayerPos);

    // Distance calculation logic:
    // - If we're the authoritative player (chased player): calculate and store our distance
    // - If we're not authoritative: check if we're closer, and if so, claim authority
    // - Use a threshold to prevent ping-ponging between players
    const AUTHORITY_SWITCH_THRESHOLD = 2.0; // Must be at least 2m closer to claim authority

    if (this.chasedPlayerId && currentPlayerId === this.chasedPlayerId) {
      // We're the authoritative player - calculate and store our distance
      // We assume we're closest until someone else claims to be closer
      this.distanceToClosestPlayer = currentPlayerDistance;
    } else if (currentPlayerId) {
      // We're not authoritative (or in WANDER with no chased player)
      // Check if we're closer than the stored distance
      if (!this.chasedPlayerId) {
        // No one is being chased - we can claim authority
        this.chasedPlayerId = currentPlayerId;
        this.distanceToClosestPlayer = currentPlayerDistance;
      } else {
        // Someone is already being chased - only claim if we're significantly closer
        const distanceDifference = this.distanceToClosestPlayer - currentPlayerDistance;
        if (distanceDifference > AUTHORITY_SWITCH_THRESHOLD) {
          // We're significantly closer! Claim authority
          this.chasedPlayerId = currentPlayerId;
          this.distanceToClosestPlayer = currentPlayerDistance;
        }
      }
    } else {
      // No current player ID available, use fallback
      this.distanceToClosestPlayer = currentPlayerDistance;
    }

    // State transitions based on stored distance
    // Priority: ATTACK > CHASE > WANDER
    // Don't transition away from CHASE/ATTACK unless truly out of range
    if (this.distanceToClosestPlayer <= ATTACK_TRIGGER_RANGE_METERS) {
      this.currentState = 'ATTACK';
      // Ensure we have a chased player when attacking
      if (!this.chasedPlayerId && currentPlayerId) {
        this.chasedPlayerId = currentPlayerId;
      }
    } else if (this.distanceToClosestPlayer <= this.CHASE_RANGE_METERS) {
      this.currentState = 'CHASE';
      // Ensure we have a chased player when chasing
      if (!this.chasedPlayerId && currentPlayerId) {
        this.chasedPlayerId = currentPlayerId;
      }
    } else {
      // Only transition to WANDER if we're truly out of range
      // And only clear chasedPlayerId if we're well beyond chase range (add hysteresis)
      const WANDER_HYSTERESIS = 5.0; // Must be 5m beyond chase range to clear
      if (this.distanceToClosestPlayer > this.CHASE_RANGE_METERS + WANDER_HYSTERESIS) {
        this.currentState = 'WANDER';
        // Clear chased player when truly wandering
        if (this.chasedPlayerId) {
          this.chasedPlayerId = null;
          this.distanceToClosestPlayer = Infinity;
        }
      } else {
        // Still within hysteresis range - maintain current state if chasing/attacking
        // This prevents rapid state switching
        if (this.currentState === 'WANDER') {
          // Only transition to chase if we're within range
          if (this.distanceToClosestPlayer <= this.CHASE_RANGE_METERS) {
            this.currentState = 'CHASE';
            if (!this.chasedPlayerId && currentPlayerId) {
              this.chasedPlayerId = currentPlayerId;
            }
          }
        }
        // Otherwise keep current state (CHASE or ATTACK)
      }
    }

    // Check if this instance is authoritative (only the chased player's instance controls movement)
    const chasedId = this.chasedPlayerId;
    const isAuthoritative =
      this.currentState === 'WANDER' || (chasedId && currentPlayerId === chasedId);

    switch (this.currentState) {
      case 'WANDER': {
        // Only authoritative instance controls movement
        if (isAuthoritative) {
          this.timeUntilRetargetSeconds -= dt;

          // Retarget periodically or when reached target
          if (
            !this.wanderTarget ||
            this.timeUntilRetargetSeconds <= 0 ||
            Vector3.distance(zombiePos, this.wanderTarget) < 0.25
          ) {
            this.wanderTarget = this.computeNewWanderTarget(zombiePos);
            this.timeUntilRetargetSeconds = 2 + Math.random() * 3; // 2-5s
          }

          this.playWalk(this.entity);
          const desiredDir = this.directionTo(zombiePos, this.wanderTarget);
          if (this.blockedAhead) {
            this.wanderTarget = this.computeNewWanderTarget(zombiePos);
          } else {
            this.moveTowards(this.entity, this.wanderTarget, this.WANDER_SPEED, dt, 0.1);
          }
          this.scheduleBlockCheck(this.entity, desiredDir, this.OBSTACLE_CHECK_DISTANCE);
        }
        break;
      }
      case 'CHASE': {
        // Only authoritative instance (the chased player's instance) controls movement
        if (isAuthoritative && this.chasedPlayerId) {
          // Use current player position directly (we're the authoritative player)
          const targetPos = getPlayerPosition();

          this.wanderTarget = null;
          this.playWalk(this.entity);
          const desiredDir = this.directionTo(zombiePos, targetPos);

          // Check for obstacles in the desired direction
          this.scheduleBlockCheck(this.entity, desiredDir, this.OBSTACLE_CHECK_DISTANCE);

          if (this.blockedAhead) {
            if (!this.avoidanceTarget) {
              const side = this.perpendicular(desiredDir, this.avoidRightNext);
              this.avoidRightNext = !this.avoidRightNext;
              this.avoidanceTarget = Vector3.create(
                zombiePos.x + side.x * 2,
                zombiePos.y,
                zombiePos.z + side.z * 2,
              );
            }
            this.moveTowards(this.entity, this.avoidanceTarget, this.WANDER_SPEED, dt, 0.1);
            if (this.horizontalDistance(this.avoidanceTarget, zombiePos) < 0.15) {
              this.avoidanceTarget = null;
            }
          } else {
            this.avoidanceTarget = null;
            // Stop within attack range, do not overlap the player
            this.moveTowards(this.entity, targetPos, this.CHASE_SPEED, dt, ATTACK_RANGE_METERS);
          }
        } else {
          // Not authoritative - just face the chased player but don't move
          if (this.chasedPlayerId) {
            const chasedPlayerInfo = this.getPlayerPositionById(this.chasedPlayerId);
            if (chasedPlayerInfo) {
              this.faceTowards(this.entity, chasedPlayerInfo.position);
            } else {
              // Fallback to current player position
              this.faceTowards(this.entity, getPlayerPosition());
            }
          }
        }
        break;
      }
      case 'ATTACK': {
        // Only authoritative instance controls attack
        if (isAuthoritative && this.chasedPlayerId) {
          // Use current player position directly (we're the authoritative player)
          const targetPos = getPlayerPosition();

          // Face the player but do not move
          this.faceTowards(this.entity, targetPos);
          this.tryAttack(this.entity);

          // Execute attack action once per second while attack animation is playing
          if (this.currentAnim === 'ATTACK') {
            this.attackActionTimer += dt;
            if (this.attackActionTimer >= 1.0) {
              this.attackActionTimer = 0;
              // Execute the "Attack" action from Actions component
              try {
                getActionEvents(this.entity).emit('Attack', {});
              } catch (error) {
                // Action might not exist, ignore error
              }
            }
          } else {
            // Reset timer when not attacking
            this.attackActionTimer = 0;
          }
        }
        break;
      }
    }
  }

  computeNewWanderTarget(origin: Vector3): Vector3 {
    // Pick a random point within a circle around origin
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.WANDER_RADIUS_METERS;
    const offsetX = Math.cos(angle) * radius;
    const offsetZ = Math.sin(angle) * radius;
    return Vector3.create(origin.x + offsetX, origin.y, origin.z + offsetZ);
  }

  moveTowards(
    entity: Entity,
    target: Vector3,
    speed: number,
    dt: number,
    stopDistance: number = 0,
  ) {
    const t = Transform.getMutable(entity);
    const pos = t.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const distance = Math.hypot(dx, dz);

    if (distance < Math.max(stopDistance, 1e-3)) return;

    const remaining = Math.max(distance - stopDistance, 0);
    const step = Math.min(speed * dt, remaining);
    const nx = dx / distance;
    const nz = dz / distance;

    // Translate
    const moveX = nx * Math.min(step, distance);
    const moveZ = nz * Math.min(step, distance);
    const newPos = Vector3.create(pos.x + moveX, pos.y, pos.z + moveZ);
    t.position = newPos;

    // Rotate to face movement direction
    const yaw = (Math.atan2(nx, nz) * 180) / Math.PI;
    t.rotation = Quaternion.fromEulerDegrees(0, yaw, 0);
  }

  faceTowards(entity: Entity, target: Vector3) {
    const t = Transform.getMutable(entity);
    const pos = t.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-3) return;
    const nx = dx / distance;
    const nz = dz / distance;
    const yaw = (Math.atan2(nx, nz) * 180) / Math.PI;
    t.rotation = Quaternion.fromEulerDegrees(0, yaw, 0);
  }

  playWalk(entity: Entity) {
    if (this.currentAnim !== 'WALK') {
      // Stop any attack
      Animator.stopAllAnimations(entity);
      const walk = Animator.getClip(entity, 'Walking');
      if (walk) {
        walk.loop = true;
        walk.playing = true;
      } else {
        Animator.playSingleAnimation(entity, 'Walking');
      }
      this.currentAnim = 'WALK';
    }
  }

  tryAttack(entity: Entity) {
    // Cooldown gate based on accumulated dt
    if (this.attackCooldownSeconds <= 0) {
      Animator.stopAllAnimations(entity);
      const attack = Animator.getClip(entity, 'Attacking');
      if (attack) {
        attack.loop = false;
        attack.playing = true;
        attack.shouldReset = true;
      } else {
        Animator.playSingleAnimation(entity, 'Attacking');
      }
      this.currentAnim = 'ATTACK';
      // Apply damage once per attack trigger if within striking range
      const targetPos = getPlayerPosition();
      const zPos = Transform.get(entity).position;
      if (this.horizontalDistance(targetPos, zPos) <= ATTACK_RANGE_METERS + 0.05) {
        //damage(2)
      }
      this.attackCooldownSeconds = ATTACK_COOLDOWN_SECONDS;
    }
  }

  /**
   * Find the closest player to the zombie
   * @param zombiePos - Zombie's current position
   * @returns Object with playerId, position, and distance, or null if no players found
   */
  findClosestPlayer(
    zombiePos: Vector3,
  ): { playerId: string; position: Vector3; distance: number } | null {
    let closestPlayer: { playerId: string; position: Vector3; distance: number } | null = null;
    let closestDistance = Infinity;

    // Iterate through all players in the scene
    for (const [_entity, identity, transform] of engine.getEntitiesWith(
      PlayerIdentityData,
      Transform,
    )) {
      // Skip if this is not a player entity (check if it has player identity)
      if (!identity.address) continue;

      const playerPos = transform.position;
      const distance = this.horizontalDistance(zombiePos, playerPos);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = {
          playerId: identity.address,
          position: playerPos,
          distance: distance,
        };
      }
    }

    return closestPlayer;
  }

  /**
   * Get a specific player's position by their ID
   * @param playerId - The player's ID (address)
   * @returns Object with position, or null if player not found
   */
  getPlayerPositionById(playerId: string | null): { position: Vector3 } | null {
    if (!playerId) return null;

    // First try to find by PlayerIdentityData address
    for (const [_entity, identity, transform] of engine.getEntitiesWith(
      PlayerIdentityData,
      Transform,
    )) {
      if (identity.address === playerId) {
        return { position: transform.position };
      }
    }

    // If not found and this is the current player, use engine.PlayerEntity as fallback
    if (playerId === this.currentPlayerId && Transform.has(engine.PlayerEntity)) {
      return { position: Transform.get(engine.PlayerEntity).position };
    }

    return null;
  }

  horizontalDistance(a: Vector3, b: Vector3) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
  }

  directionTo(from: Vector3, to: Vector3): Vector3 {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return Vector3.create(0, 0, 0);
    return Vector3.create(dx / len, 0, dz / len);
  }

  perpendicular(dir: Vector3, right: boolean): Vector3 {
    const x = dir.x;
    const z = dir.z;
    // Perpendicular on XZ plane
    return right ? Vector3.create(z, 0, -x) : Vector3.create(-z, 0, x);
  }

  scheduleBlockCheck(entity: Entity, dir: Vector3, distance: number) {
    if (dir.x === 0 && dir.z === 0) {
      this.blockedAhead = false;
      return;
    }
    raycastSystem.registerGlobalDirectionRaycast(
      {
        entity,
        opts: {
          direction: dir,
          maxDistance: distance,
          collisionMask: (ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER) as unknown as number,
        },
      },
      result => {
        this.blockedAhead = !!result && result.hits.length > 0;
      },
    );
  }
}

export function getPlayerPosition() {
  return Transform.getOrNull(engine.PlayerEntity)?.position || Vector3.create();
}
