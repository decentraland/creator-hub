import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, engine, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import { getComponents } from '@dcl/asset-packs/dist/definitions';
import type { ActionCallback } from '~sdk/script-utils';

export class ToggleButton {
  private lastState: string = '';

  /**
   * A toggle button that can be toggled by clicking it or by other smart items, to activate
   * or deactivate anything in the scene. Its state is shared with other players, so
   * everyone sees the same position.
   *
   * @param activateAnimation - Name of the animation clip in the toggle button's model that plays when it is activated.
   * @param deactivateAnimation - Name of the animation clip in the toggle button's model that plays when it is deactivated.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. sound.mp3), played whenever the toggle button is toggled. Leave empty for no sound.
   * @param hoverText - Text shown when the player points at the toggle button.
   * @param onActivate - Action triggered every time the toggle button is activated.
   * @param onDeactivate - Action triggered every time the toggle button is deactivated.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public activateAnimation: string = 'activate',
    public deactivateAnimation: string = 'deactivate',
    public sound: string = 'sound.mp3',
    public hoverText: string = 'Activate / Deactivate',
    public onActivate?: ActionCallback,
    public onDeactivate?: ActionCallback,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }

    // The toggle button's state lives in a synced component so other players see it change.
    // Every client reacts to the change inside update(), so the animation, sound and
    // callbacks run the same way whether this player, another smart item, or a
    // remote player toggled it.
    const { States } = getComponents(engine);
    if (!States.getOrNull(this.entity)) {
      States.create(this.entity, {
        id: this.entity,
        value: ['Activated', 'Deactivated'],
        defaultValue: 'Deactivated',
        currentValue: 'Deactivated',
      });
    }
    this.lastState = States.get(this.entity).currentValue ?? 'Deactivated';

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
    const current = states.currentValue ?? 'Deactivated';
    if (current === this.lastState) return;
    this.lastState = current;

    const isActivated = current === 'Activated';
    this.playAnimation(isActivated ? this.activateAnimation : this.deactivateAnimation);
    if (this.sound) {
      // playSound resets currentTime so the sound replays from the start
      AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    }
    if (isActivated) {
      if (this.onActivate) this.onActivate();
    } else {
      if (this.onDeactivate) this.onDeactivate();
    }
  }

  /**
   * Activates the toggle button
   * @action
   */
  public activate() {
    this.setState('Activated');
  }

  /**
   * Deactivates the toggle button
   * @action
   */
  public deactivate() {
    this.setState('Deactivated');
  }

  /**
   * Activates the toggle button if it is deactivated, or deactivates it if it is activated
   * @action
   */
  public toggle() {
    this.setState(this.lastState === 'Activated' ? 'Deactivated' : 'Activated');
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
