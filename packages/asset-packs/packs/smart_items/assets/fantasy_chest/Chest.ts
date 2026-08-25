import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, engine, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import { getComponents } from '@dcl/asset-packs/dist/definitions';

export class Chest {
  private lastState: string = '';

  /**
   * A chest that can be opened and closed by clicking it or by other smart items.
   * Its state is shared with other players, so everyone sees it open and close.
   *
   * @param openAnimation - Name of the animation clip in the chest's model that plays when it opens.
   * @param closeAnimation - Name of the animation clip in the chest's model that plays when it closes.
   * @param openSound - Name of an audio file inside this smart item's folder (e.g. open.mp3), played when the chest opens. Leave empty for no sound.
   * @param closeSound - Name of an audio file inside this smart item's folder (e.g. close.mp3), played when the chest closes. Leave empty for no sound.
   * @param hoverText - Text shown when the player points at the chest.
   * @param idleAnimation - Name of an animation clip to play once when the scene loads, to set the chest's resting pose. Leave empty for none.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public openAnimation: string = 'open',
    public closeAnimation: string = 'close',
    public openSound: string = 'open.mp3',
    public closeSound: string = 'close.mp3',
    public hoverText: string = 'Open / Close',
    public idleAnimation: string = 'close',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }

    // The open/closed state lives in a synced component so other players see it
    // change. Every client reacts to the change inside update(), so the animation
    // and sound play the same way whether this player, another smart item, or a
    // remote player caused it.
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

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    const states = getComponents(engine).States.getOrNull(this.entity);
    if (!states) return;
    const current = states.currentValue ?? 'Closed';
    if (current === this.lastState) return;
    this.lastState = current;

    const isOpen = current === 'Open';
    this.playAnimation(isOpen ? this.openAnimation : this.closeAnimation);
    const sound = isOpen ? this.openSound : this.closeSound;
    if (sound) {
      // playSound resets currentTime so the sound replays from the start
      AudioSource.playSound(this.entity, `${this.src}/${sound}`);
    }
  }

  /**
   * Opens the chest
   * @action
   */
  public open() {
    this.setState('Open');
  }

  /**
   * Closes the chest
   * @action
   */
  public close() {
    this.setState('Closed');
  }

  /**
   * Opens the chest if it is closed, or closes it if it is open
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
  }

  private playAnimation(clip: string) {
    if (!clip) return;
    const animator = Animator.getMutable(this.entity);
    if (!animator.states.some((s: { clip: string }) => s.clip === clip)) {
      animator.states = [...animator.states, { clip, playing: false, loop: false }];
    }
    Animator.playSingleAnimation(this.entity, clip);
  }
}
