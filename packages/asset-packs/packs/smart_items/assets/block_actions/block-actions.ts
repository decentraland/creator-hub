import type { Entity } from '@dcl/sdk/ecs';
import { engine, InputModifier } from '@dcl/sdk/ecs';

export class BlockActions {
  private disableJump: boolean = false;
  private disableRun: boolean = false;
  private disableJog: boolean = false;
  private disableWalk: boolean = false;
  private disableEmote: boolean = false;

  constructor(
    public src: string,
    public entity: Entity,
    disableJump?: boolean,
    disableRun?: boolean,
    disableJog?: boolean,
    disableWalk?: boolean,
    disableEmote?: boolean,
  ) {
    this.disableJump = disableJump ?? false;
    this.disableRun = disableRun ?? false;
    this.disableJog = disableJog ?? false;
    this.disableWalk = disableWalk ?? false;
    this.disableEmote = disableEmote ?? false;
  }

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // Script initialization
    console.log('BlockActions initialized for entity:', this.entity);
    this.applyInputModifier();
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    // Called every frame
  }

  /**
   * Apply the InputModifier component to the player entity
   */
  private applyInputModifier() {
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({
        disableAll: false,
        disableJump: this.disableJump,
        disableRun: this.disableRun,
        disableJog: this.disableJog,
        disableWalk: this.disableWalk,
        disableEmote: this.disableEmote,
      }),
    });
  }

  /**
   * @Action
   * Enable jumping for the player
   */
  enableJump() {
    this.disableJump = false;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Disable jumping for the player
   */
  disableJumpAction() {
    this.disableJump = true;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Enable running for the player
   */
  enableRun() {
    this.disableRun = false;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Disable running for the player
   */
  disableRunAction() {
    this.disableRun = true;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Enable jogging for the player
   */
  enableJog() {
    this.disableJog = false;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Disable jogging for the player
   */
  disableJogAction() {
    this.disableJog = true;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Enable walking for the player
   */
  enableWalk() {
    this.disableWalk = false;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Disable walking for the player
   */
  disableWalkAction() {
    this.disableWalk = true;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Enable emotes for the player
   */
  enableEmote() {
    this.disableEmote = false;
    this.applyInputModifier();
  }

  /**
   * @Action
   * Disable emotes for the player
   */
  disableEmoteAction() {
    this.disableEmote = true;
    this.applyInputModifier();
  }
}
