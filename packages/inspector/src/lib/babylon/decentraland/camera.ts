import * as BABYLON from '@babylonjs/core';
import type { Emitter } from 'mitt';
import mitt from 'mitt';
import { Vector3, Quaternion } from '@dcl/ecs-math';

import type { CameraMode } from '../../logic/preferences/types';
import type { EcsEntity } from './EcsEntity';
import { ArcCameraManager } from './arcCamera';
import { FreeCameraManager } from './freeCamera';

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
  private speeds: Array<number>;
  private speedIndex: number;
  private minY: number;
  private zoomSensitivity: number;
  private arcCameraManager: ArcCameraManager | null = null;
  private freeCameraManager: FreeCameraManager | null = null;
  private currentMode: CameraMode;
  private speedChangeObservable: Emitter<SpeedChangeEvent>;
  private getAspectRatio: () => number;
  private animation: AnimationData | null;
  private scene: BABYLON.Scene;
  private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

  constructor(
    scene: BABYLON.Scene,
    public inputSource: HTMLCanvasElement,
    speeds: Array<number>,
    initialSpeedIndex: number,
    minY: number,
    zoomSensitivity: number,
    cameraMode: CameraMode = 'orbit',
  ) {
    this.scene = scene;
    this.speeds = speeds;
    this.speedIndex = initialSpeedIndex;
    this.minY = minY;
    this.zoomSensitivity = zoomSensitivity;
    this.currentMode = cameraMode;
    this.speedChangeObservable = mitt<SpeedChangeEvent>();
    this.getAspectRatio = () => {
      return inputSource.width / inputSource.height;
    };
    this.animation = null;

    // Initialize the appropriate camera based on mode
    this.initializeCamera(cameraMode);

    // There is a bug when holding RMB and moving out of the window
    // that prevents Babylon to release the button event
    // Seems to only occur under specific conditions (OSX + Chromium based browsers)
    window.addEventListener('mouseout', () => this.reattachControl());
    inputSource.addEventListener('mouseout', () => this.reattachControl());

    // Register render observer for animation and minY enforcement
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.onRenderFrame(scene);
    });
  }

  /**
   * Initialize camera based on mode
   */
  private initializeCamera(mode: CameraMode): void {
    if (mode === 'orbit') {
      // Create ArcCameraManager to handle ArcRotateCamera-specific logic
      this.arcCameraManager = new ArcCameraManager(
        this.scene,
        this.inputSource,
        (faster: boolean) => {
          this.changeSpeed(faster ? SpeedIncrement.FASTER : SpeedIncrement.SLOWER);
        },
      );
      this.scene.activeCamera?.detachControl();
      this.scene.activeCamera = this.arcCameraManager.getCamera();
    } else {
      // Create FreeCameraManager to handle FreeCamera-specific logic
      this.freeCameraManager = new FreeCameraManager(
        this.scene,
        this.inputSource,
        this.speeds,
        this.speedIndex,
        this.minY,
        this.zoomSensitivity,
        (speed: number) => {
          this.speedChangeObservable.emit('change', speed);
        },
      );
      this.scene.activeCamera?.detachControl();
      this.scene.activeCamera = this.freeCameraManager.getCamera();
    }
  }

  /**
   * Hot-switch between camera modes
   */
  switchCameraMode(newMode: CameraMode): void {
    if (this.currentMode === newMode) return;

    // Dispose old camera
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      this.arcCameraManager.getCamera().detachControl();
      this.arcCameraManager.getCamera().dispose();
      this.arcCameraManager = null;
    } else if (this.currentMode === 'free' && this.freeCameraManager) {
      this.freeCameraManager.dispose();
      this.freeCameraManager = null;
    }

    // Update mode
    this.currentMode = newMode;

    // Initialize new camera
    this.initializeCamera(newMode);

    // Reset to default position to avoid weird angles from conversion
    // The default position gives a nice view of the scene from the same angle every time
    this.resetCamera();

    console.log(`[CameraManager] Switched to ${newMode} camera (reset to default position)`);
  }

  /**
   * Get current camera mode
   */
  getCameraMode(): CameraMode {
    return this.currentMode;
  }

  reattachControl() {
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      this.arcCameraManager.reattachControl();
    } else if (this.currentMode === 'free' && this.freeCameraManager) {
      this.freeCameraManager.reattachControl();
    }
  }

  getCamera() {
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      return this.arcCameraManager.getCamera();
    } else if (this.currentMode === 'free' && this.freeCameraManager) {
      return this.freeCameraManager.getCamera();
    }
    throw new Error('No active camera manager');
  }

  getGlobalPosition() {
    return this.getCamera().globalPosition;
  }

  getSpeed() {
    if (this.currentMode === 'free' && this.freeCameraManager) {
      return this.freeCameraManager.getSpeed();
    }
    return this.speeds[this.speedIndex];
  }

  getSpeedChangeObservable() {
    return this.speedChangeObservable;
  }

  setFreeCameraInvertRotation(invert: boolean) {
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      this.arcCameraManager.setPanningInvert(invert);
    } else if (this.currentMode === 'free' && this.freeCameraManager) {
      this.freeCameraManager.setAngularInvert(invert);
    }
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
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      this.arcCameraManager.centerViewOnTarget(center, idealRadius);
    } else if (this.currentMode === 'free' && this.freeCameraManager) {
      this.freeCameraManager.centerViewOnTarget(center, radius, this.getAspectRatio);
    }
  }

  resetCamera() {
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      this.arcCameraManager.resetCamera();
    } else if (this.currentMode === 'free' && this.freeCameraManager) {
      this.freeCameraManager.resetCamera();
    }
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
    // Only handle ArcRotateCamera animations here
    // FreeCamera handles its own animations and minY internally
    if (this.currentMode === 'orbit' && this.arcCameraManager) {
      const camera = this.arcCameraManager.getCamera();

      if (this.animation !== null) {
        const dt = scene.getEngine().getDeltaTime();
        this.animation.timePassed += dt / 1000;
        this.animation.timePassed = Math.min(this.animation.duration, this.animation.timePassed);
        const t = this.animation.timePassed / this.animation.duration;

        const position = Vector3.lerp(this.animation.startPos, this.animation.endPos, t);
        camera.position = new BABYLON.Vector3(position.x, position.y, position.z);

        const quat = Quaternion.slerp(this.animation.startQuat, this.animation.endQuat, t);
        const direction = Vector3.rotate(Vector3.create(0, 0, 1), quat);
        camera.target = camera.position.add(
          new BABYLON.Vector3(direction.x, direction.y, direction.z),
        );

        if (this.animation.timePassed >= this.animation.duration) this.animation = null;
      }

      // Ensure camera doesn't go below minimum Y
      if (camera.position.y <= this.minY) {
        camera.position.y = this.minY;
      }
    }
  }
}
