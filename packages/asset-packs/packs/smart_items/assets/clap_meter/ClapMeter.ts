import type { Entity } from '@dcl/sdk/ecs';
import { AvatarEmoteCommand, engine, Name, Schemas, Transform } from '@dcl/sdk/ecs';
import { syncEntity } from '@dcl/sdk/network';
import { Quaternion } from '@dcl/sdk/math';

// Component definition
export const ClapScore = engine.defineComponent(
  'ClapScore',
  {
    score: Schemas.Number,
    active: Schemas.Boolean,
    player: Schemas.String,
    avatarName: Schemas.String,
  },
  {
    score: 0,
    active: false,
    player: '',
    avatarName: '',
  },
);

export class ClapMeter {
  private currentNeedleRotation: number = 0;
  private arrow_entity: Entity | null = null;

  //private player: string
  private avatarName: string = '';
  private START_ANGLE: number = 350;
  private END_ANGLE: number = 190;

  constructor(
    public src: string,
    public entity: Entity,
    public emoteDetected: string = 'clap',
    public max_increment: number = 2,
    public min_increment: number = 1,
    public diminishing_threshold: number = 25,
  ) {
    // Find the needle child entity
    this.arrow_entity = this.findNeedleEntity();
  }

  /**
   * Finds the needle child entity by checking children of the main entity
   * Validates that there's only one child with a name starting with "Needle"
   * @returns The needle entity, or null if not found or multiple found
   */
  private findNeedleEntity(): Entity | null {
    const needleEntities: Entity[] = [];

    // Iterate through all entities with Transform to find children
    for (const [childEntity, transform] of engine.getEntitiesWith(Transform)) {
      // Check if this entity is a child of our main entity
      if (transform.parent === this.entity) {
        // Check if this child has a Name component that starts with "Needle"
        const nameComponent = Name.getOrNull(childEntity);
        if (nameComponent && nameComponent.value.startsWith('Needle')) {
          needleEntities.push(childEntity);
        }
      }
    }

    // Validate that we found exactly one needle entity
    if (needleEntities.length === 0) {
      console.error('ClapMeter: No child entity found with name starting with "Needle"');
      return null;
    } else if (needleEntities.length > 1) {
      console.error(
        `ClapMeter: Multiple children found with name starting with "Needle" (found ${needleEntities.length}). Expected exactly one.`,
      );
      return null;
    }

    return needleEntities[0];
  }

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // Validate that arrow entity was found
    if (!this.arrow_entity) {
      console.error('ClapMeter: Cannot start - needle entity not found');
      return;
    }

    // Create communication entity for syncing

    ClapScore.create(this.entity);
    syncEntity(this.entity, [ClapScore.componentId]);

    // Set up emote listener
    this.setupEmoteListener();
  }

  /**
   * Update function - called every frame
   * @param _dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    // Called every frame
  }

  /**
   * Sets up the emote listener for clap detection
   * @param needle - The needle entity
   */
  private setupEmoteListener() {
    AvatarEmoteCommand.onChange(engine.PlayerEntity, emote => {
      if (!emote) return;

      //console.log('Emote played:', emote)

      if (emote.emoteUrn === this.emoteDetected) {
        this.handleClap();
      }
    });
  }

  /**
   * Resets the clap meter to its initial state
   */
  public resetClapMeter(newPlayer: string = '') {
    if (!this.arrow_entity || !this.entity) {
      console.error('Clap meter needle not found');
      return;
    }

    // Reset score and needle rotation
    ClapScore.getMutable(this.entity).score = 0;
    ClapScore.getMutable(this.entity).player = newPlayer;
    this.currentNeedleRotation = this.START_ANGLE;
    Transform.getMutable(this.arrow_entity).rotation = Quaternion.fromEulerDegrees(
      0,
      0,
      this.currentNeedleRotation,
    );
  }

  /**
   * Calculates the angle increment based on the current score
   * Implements diminishing returns: early claps are more valuable than later ones
   * @param currentScore - The current clap score
   * @returns The angle increment for this clap
   */
  public calculateAngleIncrement(currentScore: number): number {
    if (currentScore <= this.diminishing_threshold) {
      // Early claps (before threshold) get the full base increment
      return this.max_increment;
    } else {
      // Later claps get a diminishing increment
      // Linear decrease from this.increment to MIN_ANGLE_INCREMENT
      const excessClaps = currentScore - this.diminishing_threshold;
      const diminishingFactor = Math.max(0, 1 - excessClaps / 100); // Gradually decrease to 0
      return this.min_increment + (this.max_increment - this.min_increment) * diminishingFactor;
    }
  }

  /**
   * Handles a clap event
   * @param needle - The needle entity
   */
  private handleClap() {
    if (!this.arrow_entity) {
      console.error('ClapMeter: Cannot handle clap - needle entity not found');
      return;
    }

    // Update score
    const currentScore = (ClapScore.getMutable(this.entity!).score += 1);

    // Calculate angle increment based on diminishing returns
    const angleIncrement = this.calculateAngleIncrement(currentScore);

    // Calculate new needle rotation
    this.currentNeedleRotation = this.START_ANGLE - currentScore * angleIncrement;

    // Ensure needle doesn't go beyond end angle
    if (this.currentNeedleRotation < this.END_ANGLE) {
      this.currentNeedleRotation = this.END_ANGLE;
    }

    // Update needle rotation
    Transform.getMutable(this.arrow_entity).rotation = Quaternion.fromEulerDegrees(
      0,
      0,
      this.currentNeedleRotation,
    );
  }
}
