import * as BABYLON from '@babylonjs/core';

import { PARCEL_SIZE } from '../../utils/scene';
import { Keys } from './keys';
import { LEFT_BUTTON, MIDDLE_BUTTON, RIGHT_BUTTON } from './mouse-utils';

/**
 * Constants for ArcRotateCamera configuration
 */
export class ArcCameraConstants {
  static readonly ANGULAR_SENSIBILITY = 500; // Lower = more sensitive for ArcRotateCamera (reduced for faster rotation)
  static readonly PANNING_SENSIBILITY = 50;
  static readonly WHEEL_PRECISION = 50; // For zoom with Alt+RightClick simulation
}

/**
 * Manages ArcRotateCamera-specific logic and controls
 * Handles Blender/Maya-style camera controls:
 * - Orbit: Right-click drag OR Alt+Left-click drag
 * - Pan: Alt+Middle-click drag
 * - Zoom: Mouse wheel OR Alt+Right-click drag
 */
export class ArcCameraManager {
  private camera: BABYLON.ArcRotateCamera;
  private scene: BABYLON.Scene;
  private inputSource: HTMLCanvasElement;

  // Input state tracking
  private isAltKeyDown: boolean = false;
  private isPanning: boolean = false;
  private isRotating: boolean = false;
  private isZooming: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private onSpeedChange: ((faster: boolean) => void) | null = null;

  constructor(
    scene: BABYLON.Scene,
    inputSource: HTMLCanvasElement,
    onSpeedChange?: (faster: boolean) => void,
  ) {
    this.scene = scene;
    this.inputSource = inputSource;
    this.onSpeedChange = onSpeedChange || null;
    this.camera = this.createCamera(scene);

    // Attach control but we'll handle input manually for Alt+Click behavior
    this.camera.attachControl(inputSource, true);

    // Setup custom input handlers
    this.setupCustomControls();
  }

  getCamera(): BABYLON.ArcRotateCamera {
    return this.camera;
  }

  /**
   * Reattach camera controls (useful for fixing mouse event bugs)
   */
  reattachControl(): void {
    this.camera.detachControl();
    this.camera.attachControl(this.inputSource, true);
    this.isPanning = false;
    this.isRotating = false;
    this.isZooming = false;
  }

  /**
   * Set panning sensibility inversion
   */
  setPanningInvert(invert: boolean): void {
    const sign = invert ? 1 : -1;
    this.camera.panningSensibility = sign * ArcCameraConstants.PANNING_SENSIBILITY;
  }

  /**
   * Center view on a target position with animation
   */
  centerViewOnTarget(target: BABYLON.Vector3, radius: number): void {
    this.animateCameraToTarget(target, radius);
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    const center = new BABYLON.Vector3(PARCEL_SIZE / 2, 0, PARCEL_SIZE / 2);
    const size = center.length();

    this.camera.target = center;
    this.camera.alpha = Math.PI / 4; // 45 degrees
    this.camera.beta = Math.PI / 3; // 60 degrees from horizontal
    this.camera.radius = size * 3;
  }

  /**
   * Create and configure the ArcRotateCamera
   */
  private createCamera(scene: BABYLON.Scene): BABYLON.ArcRotateCamera {
    const center = new BABYLON.Vector3(PARCEL_SIZE / 2, 0, PARCEL_SIZE / 2);
    const size = center.length();

    // Create ArcRotateCamera (alpha, beta, radius, target, scene)
    // alpha: horizontal rotation (radians)
    // beta: vertical rotation (radians)
    // radius: distance from target
    const camera = new BABYLON.ArcRotateCamera(
      'editorCamera',
      Math.PI / 4, // 45 degrees horizontal
      Math.PI / 3, // 60 degrees from horizontal
      size * 3, // distance from center
      center,
      scene,
    );

    // Configure camera behavior
    camera.inertia = 0.9; // Add smooth inertia (0 = no inertia, 1 = maximum)
    camera.panningSensibility = ArcCameraConstants.PANNING_SENSIBILITY;
    camera.angularSensibilityX = ArcCameraConstants.ANGULAR_SENSIBILITY;
    camera.angularSensibilityY = ArcCameraConstants.ANGULAR_SENSIBILITY;

    // Set camera limits
    camera.lowerRadiusLimit = 0.1; // Minimum zoom distance (very close zoom in)
    camera.upperRadiusLimit = 100000; // Maximum zoom distance (virtually unlimited)
    camera.lowerBetaLimit = 0.1; // Prevent camera from going below ground
    camera.upperBetaLimit = Math.PI - 0.1; // Prevent camera from flipping over

    // Set wheel precision for smooth zooming
    camera.wheelPrecision = ArcCameraConstants.WHEEL_PRECISION;

    // Pinch precision for touch devices
    camera.pinchPrecision = 50;

    return camera;
  }

  /**
   * Setup custom Blender-style camera controls
   */
  private setupCustomControls(): void {
    // Disable default inputs, we'll handle them manually
    this.camera.inputs.clear();

    // Add keyboard input for panning (but without W, E, R)
    const keyboardInput = new BABYLON.ArcRotateCameraKeyboardMoveInput();
    keyboardInput.keysUp = [Keys.KEY_UP];
    keyboardInput.keysDown = [Keys.KEY_DOWN];
    keyboardInput.keysLeft = [Keys.KEY_LEFT];
    keyboardInput.keysRight = [Keys.KEY_RIGHT];
    this.camera.inputs.add(keyboardInput);

    // Add mouse wheel for zoom
    const mouseWheelInput = new BABYLON.ArcRotateCameraMouseWheelInput();
    mouseWheelInput.wheelPrecision = ArcCameraConstants.WHEEL_PRECISION;
    this.camera.inputs.add(mouseWheelInput);

    // Track Alt key state
    this.scene.onPreKeyboardObservable.add(ev => {
      if (ev.type === BABYLON.KeyboardEventTypes.KEYDOWN && ev.event.inputIndex === Keys.KEY_ALT) {
        this.isAltKeyDown = true;
      }
      if (ev.type === BABYLON.KeyboardEventTypes.KEYUP && ev.event.inputIndex === Keys.KEY_ALT) {
        this.isAltKeyDown = false;
        // Reset interaction states when Alt is released
        this.isPanning = false;
        this.isRotating = false;
        this.isZooming = false;
      }
    });

    // Custom mouse control for Alt+Click combinations
    this.scene.onPointerObservable.add(ev => {
      if (ev.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;

        if (this.isAltKeyDown) {
          ev.event.preventDefault();

          if (ev.event.button === LEFT_BUTTON) {
            // Alt + Left Click = Rotate
            this.isRotating = true;
            this.camera.detachControl();
          } else if (ev.event.button === MIDDLE_BUTTON) {
            // Alt + Middle Click = Pan
            this.isPanning = true;
            this.camera.detachControl();
          } else if (ev.event.button === RIGHT_BUTTON) {
            // Alt + Right Click = Zoom
            this.isZooming = true;
            this.camera.detachControl();
          }
        } else if (ev.event.button === RIGHT_BUTTON && !this.isAltKeyDown) {
          // Right click alone also rotates (keep legacy behavior)
          this.isRotating = true;
        }
      }

      if (ev.type === BABYLON.PointerEventTypes.POINTERUP) {
        if (ev.event.button === LEFT_BUTTON) this.isRotating = false;
        if (ev.event.button === MIDDLE_BUTTON) this.isPanning = false;
        if (ev.event.button === RIGHT_BUTTON) {
          this.isRotating = false;
          this.isZooming = false;
        }

        // Reattach control when all mouse buttons are released
        if (!this.isRotating && !this.isPanning && !this.isZooming) {
          this.camera.attachControl(this.inputSource, true);
        }
      }

      if (ev.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        const deltaX = this.scene.pointerX - this.lastPointerX;
        const deltaY = this.scene.pointerY - this.lastPointerY;

        if (this.isRotating && this.isAltKeyDown) {
          // Alt + Left Click & Drag = Rotate around target
          // Left/right inverted, up/down natural
          this.camera.alpha -= deltaX / ArcCameraConstants.ANGULAR_SENSIBILITY;
          this.camera.beta -= deltaY / ArcCameraConstants.ANGULAR_SENSIBILITY;

          // Clamp beta to prevent flipping
          this.camera.beta = Math.max(0.1, Math.min(Math.PI - 0.1, this.camera.beta));
        } else if (this.isPanning) {
          // Alt + Middle Click & Drag = Pan
          const panSpeed = this.camera.radius / 1000;

          // Calculate pan vectors in camera space
          const right = this.camera.getDirection(BABYLON.Vector3.Right());
          const up = this.camera.getDirection(BABYLON.Vector3.Up());

          this.camera.target.addInPlace(right.scale(-deltaX * panSpeed));
          this.camera.target.addInPlace(up.scale(deltaY * panSpeed));
        } else if (this.isZooming) {
          // Alt + Right Click & Drag = Zoom (horizontal movement: left = zoom out, right = zoom in)
          const zoomSpeed = this.camera.radius / 200; // Increased sensitivity
          const newRadius = this.camera.radius - deltaX * zoomSpeed;
          this.camera.radius = Math.max(
            0.1, // Very close minimum
            Math.min(100000, newRadius), // Very far maximum (100k units)
          );
        }

        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;
      }

      // Handle wheel zoom and speed change
      if (ev.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
        const browserEvent = ev.event as BABYLON.IWheelEvent;

        // If right button is held down (isRotating from right-click), change speed instead of zooming
        if (this.isRotating && !this.isAltKeyDown && this.onSpeedChange) {
          // Wheel down (positive deltaY) = slower, wheel up (negative deltaY) = faster
          const isFaster = browserEvent.deltaY < 0;
          this.onSpeedChange(isFaster);
        } else if (!this.isRotating && !this.isPanning) {
          // If not interacting with camera controls, use wheel for zoom
          const zoomDelta = browserEvent.deltaY > 0 ? 1.1 : 0.9;
          this.camera.radius *= zoomDelta;
          // Clamp within camera limits (virtually unlimited)
          this.camera.radius = Math.max(
            this.camera.lowerRadiusLimit || 0.1,
            Math.min(this.camera.upperRadiusLimit || 100000, this.camera.radius),
          );
        }
      }
    });
  }

  /**
   * Animate camera to focus on a target position
   */
  private animateCameraToTarget(target: BABYLON.Vector3, radius: number): void {
    const startTarget = this.camera.target.clone();
    const startRadius = this.camera.radius;

    const duration = 0.5; // seconds
    let elapsed = 0;

    const animate = () => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;
      const t = Math.min(elapsed / duration, 1);

      // Smooth easing function
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      // Interpolate target position
      this.camera.target = BABYLON.Vector3.Lerp(startTarget, target, eased);

      // Interpolate radius
      this.camera.radius = startRadius + (radius - startRadius) * eased;

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }
}
