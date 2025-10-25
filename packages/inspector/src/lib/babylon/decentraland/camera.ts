import * as BABYLON from '@babylonjs/core';
import type { Emitter } from 'mitt';
import mitt from 'mitt';
import { Vector3, Quaternion } from '@dcl/ecs-math';

import { PARCEL_SIZE } from '../../utils/scene';
import { Keys } from './keys';
import type { EcsEntity } from './EcsEntity';
import { LEFT_BUTTON, MIDDLE_BUTTON, RIGHT_BUTTON } from './mouse-utils';

type SpeedChangeEvent = { change: number };

enum SpeedIncrement {
  FASTER = 1,
  SLOWER = -1,
}

type AnimationData = {
  startPos: Vector3;
  endPos: Vector3;
  startQuat: Quaternion;
  endQuat: Quaternion;
  timePassed: number;
  duration: number;
};

export class CameraManager {
  private static ANGULAR_SENSIBILITY = 500; // Lower = more sensitive for ArcRotateCamera (reduced for faster rotation)
  private static PANNING_SENSIBILITY = 50;
  private static WHEEL_PRECISION = 50; // For zoom with Alt+RightClick simulation
  private speeds: Array<number>;
  private speedIndex: number;
  private minY: number;
  private zoomSensitivity: number;
  private camera: BABYLON.ArcRotateCamera;
  private speedChangeObservable: Emitter<SpeedChangeEvent>;
  private getAspectRatio: () => number;
  private animation: AnimationData | null;
  private scene: BABYLON.Scene;
  private isAltKeyDown: boolean = false;
  private isPanning: boolean = false;
  private isRotating: boolean = false;
  private isZooming: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  constructor(
    scene: BABYLON.Scene,
    public inputSource: HTMLCanvasElement,
    speeds: Array<number>,
    initialSpeedIndex: number,
    minY: number,
    zoomSensitivity: number,
  ) {
    this.scene = scene;
    this.speeds = speeds;
    this.speedIndex = initialSpeedIndex;
    this.minY = minY;
    this.zoomSensitivity = zoomSensitivity;
    this.speedChangeObservable = mitt<SpeedChangeEvent>();
    this.getAspectRatio = () => {
      return inputSource.width / inputSource.height;
    };
    this.animation = null;

    this.camera = this.createCamera(scene);
    scene.activeCamera?.detachControl();
    scene.activeCamera = this.camera;
    
    // Attach control but we'll handle input manually for Alt+Click behavior
    this.camera.attachControl(inputSource, true);
    
    // Setup custom input handlers
    this.setupCustomControls();

    // There is a bug when holding RMB and moving out of the window
    // that prevents Babylon to release the button event
    // Seems to only occur under specific conditions (OSX + Chromium based browsers)
    window.addEventListener('mouseout', () => this.reattachControl());
    inputSource.addEventListener('mouseout', () => this.reattachControl());
  }

  reattachControl() {
    this.camera.detachControl();
    this.camera.attachControl(this.inputSource, true);
    this.isPanning = false;
    this.isRotating = false;
    this.isZooming = false;
  }

  getCamera() {
    return this.camera;
  }

  getGlobalPosition() {
    return this.camera.globalPosition;
  }

  getSpeed() {
    return this.speeds[this.speedIndex];
  }

  getSpeedChangeObservable() {
    return this.speedChangeObservable;
  }

  setFreeCameraInvertRotation(invert: boolean) {
    const sign = invert ? 1 : -1; // For ArcRotateCamera, inversion logic is different
    this.camera.panningSensibility = sign * CameraManager.PANNING_SENSIBILITY;
  }

  centerViewOnEntity(entity: EcsEntity) {
    // get a bounding sphere from bounding box
    const { min, max } = entity.getHierarchyBoundingVectors();
    let center: BABYLON.Vector3;
    let radius: number;
    
    // Babylon returns (MAX_VALUE, MAX_VALUE, MAX_VALUE), (MIN_VALUE, MIN_VALUE, MIN_VALUE) for empty nodes
    if (min.x === Number.MAX_VALUE) {
      center = entity.getWorldMatrix().getTranslation();
      radius = 1;
    } else {
      center = min.add(max).scale(0.5);
      radius = max.subtract(center).length();
    }
    
    // Calculate ideal camera position
    const idealRadius = radius * 3; // Distance multiplier for framing
    
    // Animate camera to focus on entity
    this.animateCameraToTarget(center, idealRadius);
  }

  private animateCameraToTarget(target: BABYLON.Vector3, radius: number) {
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

  resetCamera() {
    const center = new BABYLON.Vector3(PARCEL_SIZE / 2, 0, PARCEL_SIZE / 2);
    const size = center.length();
    
    this.camera.target = center;
    this.camera.alpha = Math.PI / 4; // 45 degrees
    this.camera.beta = Math.PI / 3; // 60 degrees from horizontal
    this.camera.radius = size * 3;
  }

  private setupCustomControls() {
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
    mouseWheelInput.wheelPrecision = CameraManager.WHEEL_PRECISION;
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
          this.camera.alpha -= deltaX / CameraManager.ANGULAR_SENSIBILITY;
          this.camera.beta -= deltaY / CameraManager.ANGULAR_SENSIBILITY;
          
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
      
      // Handle wheel zoom (keep existing behavior)
      if (ev.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
        const browserEvent = ev.event as BABYLON.IWheelEvent;
        
        // If not interacting with camera controls, use wheel for zoom
        if (!this.isRotating && !this.isPanning) {
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
    
    this.scene.registerBeforeRender(() => {
      this.onRenderFrame(this.scene);
    });
  }

  private createCamera(scene: BABYLON.Scene) {
    const center = new BABYLON.Vector3(PARCEL_SIZE / 2, 0, PARCEL_SIZE / 2);
    const size = center.length();
    
    // Create ArcRotateCamera (alpha, beta, radius, target, scene)
    // alpha: horizontal rotation (radians)
    // beta: vertical rotation (radians)
    // radius: distance from target
    const camera = new BABYLON.ArcRotateCamera(
      'editorCamera',
      Math.PI / 4,      // 45 degrees horizontal
      Math.PI / 3,      // 60 degrees from horizontal
      size * 3,         // distance from center
      center,
      scene,
    );
    
    // Configure camera behavior
    camera.inertia = 0.9; // Add smooth inertia (0 = no inertia, 1 = maximum)
    camera.panningSensibility = CameraManager.PANNING_SENSIBILITY;
    camera.angularSensibilityX = CameraManager.ANGULAR_SENSIBILITY;
    camera.angularSensibilityY = CameraManager.ANGULAR_SENSIBILITY;
    
    // Set camera limits
    camera.lowerRadiusLimit = 0.1; // Minimum zoom distance (very close zoom in)
    camera.upperRadiusLimit = 100000; // Maximum zoom distance (virtually unlimited)
    camera.lowerBetaLimit = 0.1; // Prevent camera from going below ground
    camera.upperBetaLimit = Math.PI - 0.1; // Prevent camera from flipping over
    
    // Enable panning
    camera.panningSensibility = CameraManager.PANNING_SENSIBILITY;
    
    // Set wheel precision for smooth zooming
    camera.wheelPrecision = CameraManager.WHEEL_PRECISION;
    
    // Pinch precision for touch devices
    camera.pinchPrecision = 50;
    
    return camera;
  }

  private changeSpeed(increment: SpeedIncrement) {
    if (increment === SpeedIncrement.FASTER) {
      if (this.speedIndex < this.speeds.length - 1) this.speedIndex += 1;
    } else {
      if (this.speedIndex > 0) this.speedIndex -= 1;
    }
    this.speedChangeObservable.emit('change', this.speeds[this.speedIndex]);
  }

  private onRenderFrame(scene: BABYLON.Scene) {
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

    // Ensure camera doesn't go below minimum Y
    if (this.camera.position.y <= this.minY) {
      this.camera.position.y = this.minY;
    }
  }
}
