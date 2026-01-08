import type { Entity } from '@dcl/sdk/ecs';
import {
  engine,
  Transform,
  GltfContainer,
  AudioSource,
  pointerEventsSystem,
  InputAction,
  ColliderLayer,
  Name,
} from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import { getActionEvents } from '@dcl/asset-packs/dist/events';

export class PadlockScript {
  private wheels: Entity[] = [];
  private digits: number[] = [0, 0, 0, 0];
  private buttonPressSound: Entity;
  private resolveSound: Entity;
  private isSolved: boolean = false;
  private name: string = 'Padlock';

  constructor(
    public src: string,
    public entity: Entity,
    public combination: number = 1234,
    public unlockedEntity: Entity,
  ) {
    this.name = Name.get(entity).value || this.name;

    // Create audio entities
    this.buttonPressSound = engine.addEntity();
    Transform.create(this.buttonPressSound, { parent: entity });
    AudioSource.create(this.buttonPressSound, {
      audioClipUrl: `${this.src}/sounds/Button_Press.mp3`,
      playing: false,
      loop: false,
      volume: 0.5,
    });

    this.resolveSound = engine.addEntity();
    Transform.create(this.resolveSound, { parent: entity });
    AudioSource.create(this.resolveSound, {
      audioClipUrl: `${this.src}/sounds/Resolve.mp3`,
      playing: false,
      loop: false,
      volume: 0.8,
    });
  }

  /**
   * Start function - called when the script is initialized
   */
  start() {
    console.log(`${this.name} padlock initialized for entity:`, this.entity);
    console.log('Combination:', this.combination);

    // Create 4 wheels
    const wheelPositions = [
      Vector3.create(0.195, 0.134, 0.004),
      Vector3.create(0.065, 0.134, 0.004),
      Vector3.create(-0.065, 0.134, 0.004),
      Vector3.create(-0.195, 0.134, 0.004),
    ];

    for (let i = 0; i < wheelPositions.length; i++) {
      const wheel = engine.addEntity();
      this.wheels.push(wheel);

      Transform.create(wheel, {
        parent: this.entity,
        position: wheelPositions[i],
        rotation: Quaternion.fromEulerDegrees(0, 0, 0),
      });

      GltfContainer.create(wheel, {
        src: `${this.src}/models/padlock/PadlockRullet.glb`,
        visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
        invisibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
      });

      // Make wheel interactive
      const wheelIndex = i;
      pointerEventsSystem.onPointerDown(
        {
          entity: wheel,
          opts: {
            button: InputAction.IA_POINTER,
            hoverText: 'Spin',
          },
        },
        () => {
          this.spinWheel(wheelIndex);
        },
      );
    }

    // Scramble on start
    this.scramble();
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_: number) {
    // No per-frame logic needed for this item
  }

  /**
   * Spin a specific wheel to the next digit
   */
  private spinWheel(wheelIndex: number) {
    if (this.isSolved) return;

    // Increment digit (0-9, wraps around)
    this.digits[wheelIndex] = (this.digits[wheelIndex] + 1) % 10;

    // Rotate the wheel (36 degrees per digit, 360 total)
    const rotation = this.digits[wheelIndex] * 36;
    const wheel = this.wheels[wheelIndex];
    const transform = Transform.getMutable(wheel);
    transform.rotation = Quaternion.fromEulerDegrees(rotation, 0, 0);

    // Play button press sound
    const audioSource = AudioSource.getMutable(this.buttonPressSound);
    audioSource.playing = false; // Reset
    audioSource.playing = true;

    // Check if solved
    this.checkCombination();
  }

  /**
   * Check if the current combination matches the target
   */
  private checkCombination() {
    const currentCombination = parseInt(this.digits.join(''));

    if (currentCombination === this.combination && !this.isSolved) {
      this.onSolve();
      if (this.unlockedEntity) {
        getActionEvents(this.unlockedEntity).emit('Open', {});
      }
    }
  }

  /**
   * Called when the padlock is solved
   */
  private onSolve() {
    this.isSolved = true;
    console.log(`${this.name} padlock solved!`);

    // Play resolve sound
    const audioSource = AudioSource.getMutable(this.resolveSound);
    audioSource.playing = true;
  }

  /**
   * Scramble the wheels to random positions
   */
  public scramble() {
    this.isSolved = false;

    for (let i = 0; i < 4; i++) {
      // Random digit 0-9
      this.digits[i] = Math.floor(Math.random() * 10);

      // Update wheel rotation
      const rotation = this.digits[i] * 36;
      const wheel = this.wheels[i];
      const transform = Transform.getMutable(wheel);
      transform.rotation = Quaternion.fromEulerDegrees(rotation, 0, 0);
    }

    console.log(`${this.name} padlock scrambled to:`, this.digits.join(''));
  }
}
