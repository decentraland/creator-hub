import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, engine } from '@dcl/sdk/ecs';
import { isStateSyncronized } from '@dcl/sdk/network';
import { getComponents } from '@dcl/asset-packs/dist/definitions';

const STATES: string[] = ['Down', 'Up', 'Stairs'];
const SETTLE_SECONDS = 1;

export class PistonPlatform {
  private lastState: string = '';
  private movedHere = false;
  private syncedFor = 0;
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A platform on five pistons with three positions: fully down, fully up, or stepped
   * into a staircase. Its position is shared with other players; each client plays the
   * animation and sound itself when the shared position changes. A player who joins later
   * sees it already in place, with no move, sound or events.
   * The model's transitions are named <From>To<To> (for example DownToStairs), plus a
   * one-frame hold clip per position.
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
    public startState: 'Down' | 'Up' | 'Stairs' = 'Up',
    public sound: string = 'sound.mp3',
  ) {}

  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }
    const initial = STATES.includes(this.startState) ? this.startState : 'Up';
    const { States } = getComponents(engine);
    // Keep a valid synced position (another player already moved it); otherwise start fresh.
    const synced = States.getOrNull(this.entity)?.currentValue;
    const current = synced && STATES.includes(synced) ? synced : initial;
    States.createOrReplace(this.entity, {
      id: this.entity,
      value: STATES,
      defaultValue: initial,
      currentValue: current,
    });
    // Pose the model to match: its rest pose is not guaranteed (an explorer may show the first
    // clip instead), and the first transition must start from what the player sees. The model
    // carries a one-frame hold clip per position ('Up', 'Down', 'Stairs').
    this.playAnimation(current);
    this.lastState = current;
  }

  update(dt: number) {
    const settled = this.syncedFor >= SETTLE_SECONDS;
    this.syncedFor = isStateSyncronized() ? this.syncedFor + dt : 0;
    const states = getComponents(engine).States.getOrNull(this.entity);
    if (!states) return;
    const current = states.currentValue ?? 'Up';
    if (current === this.lastState) return;
    const animate = settled || this.movedHere;
    this.movedHere = false;
    this.playAnimation(animate ? `${this.lastState}To${current}` : current);
    this.lastState = current;
    if (!animate) return;
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
    this.movedHere = true;
  }

  private playAnimation(clip: string) {
    const animator = Animator.getMutable(this.entity);
    if (!animator.states.some((s: { clip: string }) => s.clip === clip)) {
      animator.states = [...animator.states, { clip, playing: false, loop: false }];
    }
    Animator.playSingleAnimation(this.entity, clip);
  }
}
