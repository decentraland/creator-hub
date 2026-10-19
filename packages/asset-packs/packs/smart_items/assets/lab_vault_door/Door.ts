import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, engine, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import { isStateSyncronized } from '@dcl/sdk/network';
import { getComponents } from '@dcl/asset-packs/dist/definitions';

const SETTLE_SECONDS = 1;
const JUMP_TO_END_SPEED = 1000;

export class Door {
  private lastState: string = '';
  private movedHere = false;
  private syncedFor = 0;
  // Reactions subscribe here (via getAllScriptInstances + onEvent); update() fans out to them.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A door that can be opened and closed by clicking it or by other smart items.
   * Its state is shared with other players, so everyone sees it open and close. A player who
   * joins later sees it already open or closed, with no animation, sound or events.
   *
   * @event open
   * @event close
   *
   * @param openAnimation - Name of the animation clip in the door's model that plays when it opens.
   * @param closeAnimation - Name of the animation clip in the door's model that plays when it closes.
   * @param openSound - Name of an audio file inside this smart item's folder (e.g. open.mp3), played when the door opens. Leave empty for no sound.
   * @param closeSound - Name of an audio file inside this smart item's folder (e.g. close.mp3), played when the door closes. Leave empty for no sound.
   * @param hoverText - Text shown when the player points at the door.
   * @param idleAnimation - Name of an animation clip to play once when the scene loads, to set the door's resting pose. Leave empty for none.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public openAnimation: string = 'open',
    public closeAnimation: string = 'close',
    public openSound: string = 'sound.mp3',
    public closeSound: string = 'sound.mp3',
    public hoverText: string = 'Open / Close',
    public idleAnimation: string = '',
  ) {}

  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }

    const { States } = getComponents(engine);
    if (!States.getOrNull(this.entity)) {
      States.create(this.entity, {
        id: this.entity,
        value: ['Open', 'Closed'],
        defaultValue: 'Closed',
        currentValue: 'Closed',
      });
    }
    this.lastState = States.get(this.entity).currentValue ?? 'Closed';

    if (this.idleAnimation) {
      this.playAnimation(this.idleAnimation);
    }
    if (this.lastState === 'Open') {
      this.playAnimation(this.openAnimation, JUMP_TO_END_SPEED);
    }

    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => this.toggle(),
    );
  }

  update(dt: number) {
    const settled = this.syncedFor >= SETTLE_SECONDS;
    this.syncedFor = isStateSyncronized() ? this.syncedFor + dt : 0;
    const states = getComponents(engine).States.getOrNull(this.entity);
    if (!states) return;
    const current = states.currentValue ?? 'Closed';
    if (current === this.lastState) return;
    this.lastState = current;
    const animate = settled || this.movedHere;
    this.movedHere = false;

    const isOpen = current === 'Open';
    const clip = isOpen ? this.openAnimation : this.closeAnimation;
    this.playAnimation(clip, animate ? 1 : JUMP_TO_END_SPEED);
    if (!animate) return;
    const sound = isOpen ? this.openSound : this.closeSound;
    if (sound) {
      AudioSource.playSound(this.entity, `${this.src}/${sound}`);
    }
    for (const fn of this.subs[isOpen ? 'open' : 'close'] ?? []) fn();
  }

  /** Subscribe a reaction to this item's events ('open' / 'close'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  /**
   * Opens the door
   * @action
   */
  public open() {
    this.setState('Open');
  }

  /**
   * Closes the door
   * @action
   */
  public close() {
    this.setState('Closed');
  }

  /**
   * Opens the door if it is closed, or closes it if it is open
   * @action
   */
  public toggle() {
    this.setState(this.lastState === 'Open' ? 'Closed' : 'Open');
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

  private playAnimation(clip: string, speed = 1) {
    if (!clip) return;
    const animator = Animator.getMutable(this.entity);
    const state = animator.states.find((s: { clip: string }) => s.clip === clip);
    if (state) {
      state.speed = speed;
    } else {
      animator.states = [...animator.states, { clip, playing: false, loop: false, speed }];
    }
    Animator.playSingleAnimation(this.entity, clip);
  }
}
