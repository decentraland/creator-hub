import * as BABYLON from '@babylonjs/core';
import { Vector3, Quaternion } from '@dcl/ecs-math';

import { fitSphereIntoCameraFrustum } from '../../logic/math';
import { PARCEL_SIZE } from '../../utils/scene';
import { Keys, keyState } from './keys';
import { LEFT_BUTTON, RIGHT_BUTTON } from './mouse-utils';

/**
 * Constants for FreeCamera configuration
 */
export class FreeCameraConstants {
  static readonly ANGULAR_SENSIBILITY = 500;
}

type AnimationData = {
  startPos: Vector3;
  endPos: Vector3;
  startQuat: Quaternion;
  endQuat: Quaternion;
  timePassed: number;
  duration: number;
};

/**
 * Manages FreeCamera-specific logic and controls
 * Handles legacy WASD fly-style camera controls:
 * - Movement: WASD keys for horizontal movement, Q/E for vertical
 * - Look: Right-click drag to rotate view
 * - Zoom: Mouse wheel
 * - Speed: Right-click + scroll or movement + scroll to change speed
 */
export class FreeCameraManager {
  private camera: BABYLON.FreeCamera;
  private scene: BABYLON.Scene;
  private inputSource: HTMLCanvasElement;
  private speeds: Array<number>;
  private speedIndex: number;
  private minY: number;
  private zoomSensitivity: number;
  private getAspectRatio: () => number;
  private animation: AnimationData | null;
  private onSpeedChange: ((speed: number) => void) | null = null;
  private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

  constructor(
    scene: BABYLON.Scene,
    inputSource: HTMLCanvasElement,
    speeds: Array<number>,
    initialSpeedIndex: number,
    minY: number,
    zoomSensitivity: number,
    onSpeedChange?: (speed: number) => void,
  ) {
    this.scene = scene;
    this.inputSource = inputSource;
    this.speeds = speeds;
    this.speedIndex = initialSpeedIndex;
    this.minY = minY;
    this.zoomSensitivity = zoomSensitivity;
    this.onSpeedChange = onSpeedChange || null;
    this.getAspectRatio = () => {
      return inputSource.width / inputSource.height;
    };
    this.animation = null;

    this.camera = this.createCamera(scene);
    this.camera.attachControl(inputSource, true);
  }

  getCamera(): BABYLON.FreeCamera {
    return this.camera;
  }

  /**
   * Reattach camera controls (useful for fixing mouse event bugs)
   */
  reattachControl(): void {
    this.camera.detachControl();
    this.camera.attachControl(this.inputSource, true);
  }

  /**
   * Set angular sensibility inversion
   */
  setAngularInvert(invert: boolean): void {
    const sign = invert ? -1 : 1;
    this.camera.angularSensibility = sign * FreeCameraConstants.ANGULAR_SENSIBILITY;
  }

  /**
   * Get current camera speed
   */
  getSpeed(): number {
    return this.speeds[this.speedIndex];
  }

  /**
   * Center view on a target with animation
   */
  centerViewOnTarget(center: BABYLON.Vector3, radius: number, getAspectRatio: () => number): void {
    const position = fitSphereIntoCameraFrustum(
      this.camera.position,
      this.camera.fov,
      getAspectRatio(),
      this.camera.minZ,
      this.minY,
      center,
      radius,
    );

    this.animation = {
      startPos: this.camera.position,
      endPos: position,
      startQuat: Quaternion.fromLookAt(this.camera.position, this.camera.target),
      endQuat: Quaternion.fromLookAt(position, center),
      duration: 0.2,
      timePassed: 0,
    };
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    const center = new BABYLON.Vector3(PARCEL_SIZE / 2, 0, PARCEL_SIZE / 2);
    const size = center.length();
    this.camera.position = center.subtractFromFloats(size, -size * 1.5, size * 2);
    this.camera.target = center;
  }

  /**
   * Dispose the camera and cleanup
   */
  dispose(): void {
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
    this.camera.detachControl();
    this.camera.dispose();
  }

  /**
   * Create and configure the FreeCamera
   */
  private createCamera(scene: BABYLON.Scene): BABYLON.FreeCamera {
    const center = new BABYLON.Vector3(PARCEL_SIZE / 2, 0, PARCEL_SIZE / 2);
    const size = center.length();
    const camera = new BABYLON.FreeCamera(
      'editorCamera',
      center.subtractFromFloats(size, -size * 1.5, size * 2),
      scene,
    );
    const mouseInput = camera.inputs.attached.mouse as BABYLON.FreeCameraMouseInput;
    camera.target = center;

    mouseInput.buttons = [RIGHT_BUTTON]; // move camera with right mouse button only

    camera.inertia = 0;
    camera.speed = this.speeds[this.speedIndex];
    camera.angularSensibility = FreeCameraConstants.ANGULAR_SENSIBILITY;

    // Setup WASD + Q/E keyboard controls
    camera.keysDown = [Keys.KEY_S, Keys.KEY_DOWN];
    camera.keysUp = [Keys.KEY_W, Keys.KEY_UP];
    camera.keysLeft = [Keys.KEY_A, Keys.KEY_LEFT];
    camera.keysRight = [Keys.KEY_D, Keys.KEY_RIGHT];
    camera.keysDownward = [Keys.KEY_Q];
    camera.keysUpward = [Keys.KEY_E];

    const isCameraMoving = (): boolean => {
      for (const key of camera.keysDown) if (keyState[key]) return true;
      for (const key of camera.keysUp) if (keyState[key]) return true;
      for (const key of camera.keysLeft) if (keyState[key]) return true;
      for (const key of camera.keysRight) if (keyState[key]) return true;
      for (const key of camera.keysDownward) if (keyState[key]) return true;
      for (const key of camera.keysUpward) if (keyState[key]) return true;
      return false;
    };

    // Handle Alt key for alternate mouse button behavior
    let isAltKeyDown = false;
    scene.onPreKeyboardObservable.add(ev => {
      const oldAltKeyState = isAltKeyDown;
      if (ev.type === BABYLON.KeyboardEventTypes.KEYDOWN && ev.event.inputIndex === Keys.KEY_ALT) {
        isAltKeyDown = true;
      }

      if (ev.type === BABYLON.KeyboardEventTypes.KEYUP && ev.event.inputIndex === Keys.KEY_ALT) {
        isAltKeyDown = false;
      }

      if (isAltKeyDown) {
        mouseInput.buttons = [LEFT_BUTTON, RIGHT_BUTTON]; // move camera with left/right mouse buttons
      } else {
        mouseInput.buttons = [RIGHT_BUTTON]; // move camera with right mouse button only
        if (oldAltKeyState) {
          // reattach control to avoid camera sticking to the pointer bug...
          this.reattachControl();
        }
      }
    });

    // Handle mouse wheel for zoom and speed change
    let holdingRightMouseButton = false;
    scene.onPointerObservable.add(ev => {
      if (ev.type === BABYLON.PointerEventTypes.POINTERDOWN && ev.event.button === RIGHT_BUTTON) {
        holdingRightMouseButton = true;
      }
      if (ev.type === BABYLON.PointerEventTypes.POINTERUP && ev.event.button === RIGHT_BUTTON) {
        holdingRightMouseButton = false;
      }
      if (ev.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
        const browserEvent = ev.event as BABYLON.IWheelEvent;

        if (holdingRightMouseButton || isCameraMoving()) {
          // Change speed when moving or holding right button
          if (browserEvent.deltaY < 0) this.changeSpeed(1);
          else if (browserEvent.deltaY > 0) this.changeSpeed(-1);
        } else {
          // Zoom in/out
          const direction = camera.target.subtract(camera.position);
          direction.normalize().scaleInPlace(this.zoomSensitivity);
          if (browserEvent.deltaY > 0) direction.negateInPlace();
          camera.position.addInPlace(direction);
        }
      }
    });

    // Register render observer for animation and minY enforcement
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.onRenderFrame(scene);
    });

    return camera;
  }

  /**
   * Change camera speed
   */
  private changeSpeed(increment: number): void {
    const newIndex = this.speedIndex + increment;
    if (newIndex >= 0 && newIndex < this.speeds.length) {
      this.speedIndex = newIndex;
      this.camera.speed = this.speeds[this.speedIndex];
      if (this.onSpeedChange) {
        this.onSpeedChange(this.camera.speed);
      }
    }
  }

  /**
   * Handle render frame for animations and constraints
   */
  private onRenderFrame(scene: BABYLON.Scene): void {
    // Handle camera animation
    if (this.animation !== null) {
      const dt = scene.getEngine().getDeltaTime();
      this.animation.timePassed += dt / 1000;
      this.animation.timePassed = Math.min(this.animation.duration, this.animation.timePassed);
      const t = this.animation.timePassed / this.animation.duration;

      const position = Vector3.lerp(this.animation.startPos, this.animation.endPos, t);
      this.camera.position = new BABYLON.Vector3(position.x, position.y, position.z);

      const quat = Quaternion.slerp(this.animation.startQuat, this.animation.endQuat, t);
      const direction = Vector3.rotate(Vector3.create(0, 0, 1), quat);
      this.camera.target = this.camera.position.add(
        new BABYLON.Vector3(direction.x, direction.y, direction.z),
      );

      if (this.animation.timePassed >= this.animation.duration) this.animation = null;
    }

    // Enforce minimum Y position
    if (this.camera.position.y <= this.minY) {
      this.camera.position.y = this.minY;
    }
  }
}
