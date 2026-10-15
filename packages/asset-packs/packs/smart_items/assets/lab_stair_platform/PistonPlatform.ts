import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, engine } from '@dcl/sdk/ecs';
import { getComponents } from '@dcl/asset-packs/dist/definitions';

const STATES = ['Down', 'Up', 'Stairs'];

export class PistonPlatform {
  private lastState: string = '';
  // Reactions subscribe here (via getAllScriptInstances + onEvent); update() fans out to them.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A platform on five pistons with three positions: fully down, fully up, or stepped
   * into a staircase. Its position is shared with other players.
   * The model's clips are named <From>To<To>, for example DownToStairs.
   *
   * @event down
   * @event up
   * @event stairs
   *
   * @param startState - Position when the scene loads: Down, Up or Stairs.
   * @param sound - Name of an audio file inside this smart item's folder, played on every move. Leave empty for no sound.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public startState: string = 'Up',
    public sound: string = 'sound.mp3',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }
    const initial = STATES.includes(this.startState) ? this.startState : 'Up';
    const { States } = getComponents(engine);
    if (!States.getOrNull(this.entity)) {
      States.create(this.entity, {
        id: this.entity,
        value: STATES,
        defaultValue: initial,
        currentValue: initial,
      });
    }
    // The model rests fully up; snap to the start position without a sound.
    this.lastState = 'Up';
    const current = States.get(this.entity).currentValue ?? initial;
    if (current !== 'Up') {
      this.playAnimation(`UpTo${current}`);
      this.lastState = current;
    }
  }

  /**
   * Update function - called every frame
   * @param _dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    const states = getComponents(engine).States.getOrNull(this.entity);
    if (!states) return;
    const current = states.currentValue ?? 'Up';
    if (current === this.lastState) return;
    this.playAnimation(`${this.lastState}To${current}`);
    this.lastState = current;
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    for (const fn of this.subs[current.toLowerCase()] ?? []) fn();
  }

  /** Subscribe a reaction to this item's events ('down' / 'up' / 'stairs'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  /**
   * Lowers every piston fully
   * @action
   */
  public lower() {
    this.setState('Down');
  }

  /**
   * Raises every piston fully
   * @action
   */
  public raise() {
    this.setState('Up');
  }

  /**
   * Sets the pistons at stepped heights, forming a staircase
   * @action
   */
  public makeStairs() {
    this.setState('Stairs');
  }

  /**
   * Moves to the next position: Down, Up, Stairs, then back to Down
   * @action
   */
  public cycle() {
    this.setState(STATES[(STATES.indexOf(this.lastState) + 1) % STATES.length]);
  }

  private setState(next: string) {
    const { States } = getComponents(engine);
    const current = States.getOrNull(this.entity);
    if (!current || current.currentValue === next) return;
    const states = States.getMutable(this.entity);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  }

  private playAnimation(clip: string) {
    const animator = Animator.getMutable(this.entity);
    if (!animator.states.some((s: { clip: string }) => s.clip === clip)) {
      animator.states = [...animator.states, { clip, playing: false, loop: false }];
    }
    Animator.playSingleAnimation(this.entity, clip);
  }
}
