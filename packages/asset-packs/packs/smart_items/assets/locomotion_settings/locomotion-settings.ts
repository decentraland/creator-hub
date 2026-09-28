import type { Entity } from '@dcl/sdk/ecs';
import { AvatarLocomotionSettings, engine } from '@dcl/sdk/ecs';

// A number edited with a slider in the Creator Hub UI: Slider<min, max, step>
type Slider<_Min extends number, _Max extends number, _Step extends number = 1> = number;

export class LocomotionSettings {
  /**
   * @param walkSpeed - Speed when walking, in meters per second (default: 1.5)
   * @param jogSpeed - Speed when jogging (the standard way to move), in meters per second (default: 8)
   * @param runSpeed - Speed when running, in meters per second (default: 10)
   * @param jumpHeight - Height of a regular jump, in meters (default: 1)
   * @param runJumpHeight - Height of a jump while running, in meters (default: 1.5)
   * @param doubleJumpHeight - Height of the second jump when double-jumping, in meters (default: 2)
   * @param glidingSpeed - Horizontal speed while gliding, in meters per second (default: 6)
   * @param glidingFallingSpeed - Maximum falling speed while gliding, in meters per second (default: 1)
   * @param hardLandingCooldown - Time the player can't move after a hard landing, in seconds (default: 0.75)
   */
  constructor(
    public src: string,
    public entity: Entity,
    public walkSpeed: Slider<0, 10, 0.1> = 1.5,
    public jogSpeed: Slider<0, 30, 0.5> = 8,
    public runSpeed: Slider<0, 50, 0.5> = 10,
    public jumpHeight: Slider<0, 10, 0.1> = 1,
    public runJumpHeight: Slider<0, 10, 0.1> = 1.5,
    public doubleJumpHeight: Slider<0, 15, 0.1> = 2,
    public glidingSpeed: Slider<0, 30, 0.5> = 6,
    public glidingFallingSpeed: Slider<0, 10, 0.1> = 1,
    public hardLandingCooldown: Slider<0, 5, 0.05> = 0.75,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    console.log('LocomotionSettings initialized for entity:', this.entity);
    this.applySettings();
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    // Called every frame
  }

  /**
   * Write the current values to the player's AvatarLocomotionSettings component
   */
  private applySettings() {
    AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
      walkSpeed: this.walkSpeed,
      jogSpeed: this.jogSpeed,
      runSpeed: this.runSpeed,
      jumpHeight: this.jumpHeight,
      runJumpHeight: this.runJumpHeight,
      doubleJumpHeight: this.doubleJumpHeight,
      glidingSpeed: this.glidingSpeed,
      glidingFallingSpeed: this.glidingFallingSpeed,
      hardLandingCooldown: this.hardLandingCooldown,
    });
  }

  /**
   * @action
   * Apply the configured speeds and jump heights to the player
   */
  apply() {
    this.applySettings();
  }

  /**
   * @action
   * Restore the player's default speeds and jump heights
   */
  restoreDefaults() {
    AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity);
  }
}
