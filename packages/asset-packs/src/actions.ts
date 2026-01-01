import type {
  IEngine,
  Entity,
  TextAlignMode,
  Font,
  Move,
  PBTween,
  Rotate,
  Scale,
  PointerEventsSystem,
} from '@dcl/ecs';
import {
  Material,
  AudioStream,
  YGUnit,
  YGPositionType,
  PointerFilterMode,
  InputAction,
  MeshCollider,
  getComponentEntityTree,
  Tween,
} from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import type { TextureMovementType as SdkTextureMovementType } from '@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/tween.gen';
import { getEntityParent, getPlayerPosition, getWorldPosition, getWorldRotation } from './helpers';
import type { ActionPayload, ISDKHelpers, IPlayersHelper, ScreenAlignMode } from './definitions';
import {
  ActionType,
  ProximityLayer,
  TriggerType,
  TweenType,
  clone,
  getComponents,
  initVideoPlayerComponentMaterial,
} from './definitions';
import { getDefaultValue, isValidState } from './states';
import { getActionEvents, getTriggerEvents } from './events';
import {
  startInterval,
  startTimeout,
  stopAllIntervals,
  stopAllTimeouts,
  stopInterval,
  stopTimeout,
} from './timer';
import { getPayload } from './action-types';
import {
  getUIBackground,
  getUIText,
  getUITransform,
  mapAlignToScreenAlign,
  showCaptchaPrompt,
} from './ui';
import { getExplorerComponents } from './components';
import { initTriggers, damageTargets, healTargets } from './triggers';
import { followMap } from './transform';
import { getEasingFunctionFromInterpolation } from './tweens';
import { REWARDS_SERVER_URL } from './admin-toolkit-ui/constants';
import { requestTeleport } from '~system/UserActionModule';
import {
  movePlayerTo,
  triggerEmote,
  triggerSceneEmote,
  openExternalUrl,
} from '~system/RestrictedActions';
import type { FlatFetchInit } from '~system/SignedFetch';
import { getRealm } from '~system/Runtime';
import { signedFetch } from '~system/SignedFetch';

const initedEntities = new Set<Entity>();
const uiStacks = new Map<string, Entity>();
const lastUiEntityClicked = new Map<Entity, Entity>();
const textEntities = new Map<Entity, Entity>(); // Model Entity, Text Entity

let internalInitActions: ((entity: Entity) => void) | null = null;

export function initActions(entity: Entity) {
  if (internalInitActions) {
    return internalInitActions(entity);
  }
  throw new Error('Cannot call initActions while actionsSystem has not been created');
}

export function createActionsSystem(
  engine: IEngine,
  pointerEventsSystem: PointerEventsSystem,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  const {
    Animator,
    Transform,
    AudioSource,
    AvatarAttach,
    VisibilityComponent,
    GltfContainer,
    UiTransform,
    UiText,
    UiBackground,
    UiInput,
    UiInputResult,
    Tween: TweenComponent,
    TweenSequence,
    VideoPlayer,
    LightSource,
    MainCamera,
    VirtualCamera,
    TextShape,
    InputModifier,
    SkyboxTime,
  } = getExplorerComponents(engine);
  const { Actions, States, Counter, Triggers, Rewards } = getComponents(engine);

  // save internal reference to init funcion
  internalInitActions = initActions;

  return function actionsSystem(_dt: number) {
    const entitiesWithActions = engine.getEntitiesWith(Actions);

    for (const [entity] of entitiesWithActions) {
      initActions(entity);
    }
  };

  function initActions(entity: Entity) {
    if (!Actions.has(entity) || initedEntities.has(entity)) {
      return;
    }

    // get actions data
    const actions = Actions.get(entity);

    // initialize actions for given entity
    const types = actions.value.reduce(
      (types, action) => types.add(action.type),
      new Set<string>(),
    );

    for (const type of types) {
      switch (type) {
        case ActionType.PLAY_ANIMATION: {
          initPlayAnimation(entity);
          break;
        }
        default:
          break;
      }
    }

    // bind actions
    const actionEvents = getActionEvents(entity);
    for (const action of actions.value) {
      actionEvents.on(action.name, () => {
        switch (action.type) {
          case ActionType.PLAY_ANIMATION: {
            handlePlayAnimation(entity, getPayload<ActionType.PLAY_ANIMATION>(action));
            break;
          }
          case ActionType.STOP_ANIMATION: {
            handleStopAnimation(entity, getPayload<ActionType.STOP_ANIMATION>(action));
            break;
          }
          case ActionType.SET_STATE: {
            handleSetState(entity, getPayload<ActionType.SET_STATE>(action));
            break;
          }
          case ActionType.START_TWEEN: {
            handleStartTween(entity, getPayload<ActionType.START_TWEEN>(action));
            break;
          }
          case ActionType.STOP_TWEEN: {
            handleStopTween(entity);
            break;
          }
          case ActionType.SLIDE_TEXTURE: {
            handleSlideTexture(entity, getPayload<ActionType.SLIDE_TEXTURE>(action));
            break;
          }
          case ActionType.SET_COUNTER: {
            handleSetCounter(entity, getPayload<ActionType.SET_COUNTER>(action));
            break;
          }
          case ActionType.INCREMENT_COUNTER: {
            handleIncrementCounter(entity, getPayload<ActionType.INCREMENT_COUNTER>(action));
            break;
          }
          case ActionType.DECREASE_COUNTER: {
            handleDecreaseCounter(entity, getPayload<ActionType.DECREASE_COUNTER>(action));
            break;
          }
          case ActionType.PLAY_SOUND: {
            handlePlaySound(entity, getPayload<ActionType.PLAY_SOUND>(action));
            break;
          }
          case ActionType.STOP_SOUND: {
            handleStopSound(entity, getPayload<ActionType.STOP_SOUND>(action));
            break;
          }
          case ActionType.SET_VISIBILITY: {
            handleSetVisibility(entity, getPayload<ActionType.SET_VISIBILITY>(action));
            break;
          }
          case ActionType.ATTACH_TO_PLAYER: {
            handleAttachToPlayer(entity, getPayload<ActionType.ATTACH_TO_PLAYER>(action));
            break;
          }
          case ActionType.DETACH_FROM_PLAYER: {
            handleDetachFromPlayer(entity, getPayload<ActionType.DETACH_FROM_PLAYER>(action));
            break;
          }
          case ActionType.PLAY_VIDEO_STREAM: {
            handlePlayVideo(entity, getPayload<ActionType.PLAY_VIDEO_STREAM>(action));
            break;
          }
          case ActionType.STOP_VIDEO_STREAM: {
            handleStopVideo(entity, getPayload<ActionType.STOP_VIDEO_STREAM>(action));
            break;
          }
          case ActionType.PLAY_AUDIO_STREAM: {
            handlePlayAudioStream(entity, getPayload<ActionType.PLAY_AUDIO_STREAM>(action));
            break;
          }
          case ActionType.STOP_AUDIO_STREAM: {
            handleStopAudioStream(entity, getPayload<ActionType.STOP_AUDIO_STREAM>(action));
            break;
          }
          case ActionType.TELEPORT_PLAYER: {
            handleTeleportPlayer(entity, getPayload<ActionType.TELEPORT_PLAYER>(action));
            break;
          }
          case ActionType.MOVE_PLAYER: {
            handleMovePlayer(entity, getPayload<ActionType.MOVE_PLAYER>(action));
            break;
          }
          case ActionType.PLAY_DEFAULT_EMOTE: {
            handlePlayDefaultEmote(entity, getPayload<ActionType.PLAY_DEFAULT_EMOTE>(action));
            break;
          }
          case ActionType.PLAY_CUSTOM_EMOTE: {
            handlePlayCustomEmote(entity, getPayload<ActionType.PLAY_CUSTOM_EMOTE>(action));
            break;
          }
          case ActionType.OPEN_LINK: {
            handleOpenLink(entity, getPayload<ActionType.OPEN_LINK>(action));
            break;
          }
          case ActionType.SHOW_TEXT: {
            handleShowText(entity, getPayload<ActionType.SHOW_TEXT>(action));
            break;
          }
          case ActionType.HIDE_TEXT: {
            handleHideText(entity, getPayload<ActionType.HIDE_TEXT>(action));
            break;
          }
          case ActionType.START_DELAY: {
            handleStartDelay(entity, getPayload<ActionType.START_DELAY>(action));
            break;
          }
          case ActionType.STOP_DELAY: {
            handleStopDelay(entity, getPayload<ActionType.STOP_DELAY>(action));
            break;
          }
          case ActionType.START_LOOP: {
            handleStartLoop(entity, getPayload<ActionType.START_LOOP>(action));
            break;
          }
          case ActionType.STOP_LOOP: {
            handleStopLoop(entity, getPayload<ActionType.STOP_LOOP>(action));
            break;
          }
          case ActionType.CLONE_ENTITY: {
            handleCloneEntity(entity, getPayload<ActionType.CLONE_ENTITY>(action));
            break;
          }
          case ActionType.REMOVE_ENTITY: {
            handleRemoveEntity(entity, getPayload<ActionType.REMOVE_ENTITY>(action));
            break;
          }
          case ActionType.SHOW_IMAGE: {
            handleShowImage(entity, getPayload<ActionType.SHOW_IMAGE>(action));
            break;
          }
          case ActionType.HIDE_IMAGE: {
            handleHideImage(entity, getPayload<ActionType.HIDE_IMAGE>(action));
            break;
          }
          case ActionType.DAMAGE: {
            handleDamage(entity, getPayload<ActionType.DAMAGE>(action));
            break;
          }
          case ActionType.MOVE_PLAYER_HERE: {
            handleMovePlayerHere(entity, getPayload<ActionType.MOVE_PLAYER_HERE>(action));
            break;
          }
          case ActionType.PLAYER_FACE_ITEM: {
            handlePlayerFaceItem(entity, getPayload<ActionType.PLAYER_FACE_ITEM>(action));
            break;
          }
          case ActionType.FOLLOW_PLAYER: {
            handleFollowPlayer(entity, getPayload<ActionType.FOLLOW_PLAYER>(action));
            break;
          }
          case ActionType.STOP_FOLLOWING_PLAYER: {
            handleStopFollowingPlayer(entity, getPayload<ActionType.STOP_FOLLOWING_PLAYER>(action));
            break;
          }
          case ActionType.PLACE_ON_PLAYER: {
            handlePlaceOnPlayer(entity, getPayload<ActionType.PLACE_ON_PLAYER>(action));
            break;
          }
          case ActionType.ROTATE_AS_PLAYER: {
            handleRotateAsPlayer(entity, getPayload<ActionType.ROTATE_AS_PLAYER>(action));
            break;
          }
          case ActionType.PLACE_ON_CAMERA: {
            handlePlaceOnCamera(entity, getPayload<ActionType.PLACE_ON_CAMERA>(action));
            break;
          }
          case ActionType.ROTATE_AS_CAMERA: {
            handleRotateAsCamera(entity, getPayload<ActionType.ROTATE_AS_CAMERA>(action));
            break;
          }
          case ActionType.SET_POSITION: {
            handleSetPosition(entity, getPayload<ActionType.SET_POSITION>(action));
            break;
          }
          case ActionType.SET_ROTATION: {
            handleSetRotation(entity, getPayload<ActionType.SET_ROTATION>(action));
            break;
          }
          case ActionType.SET_SCALE: {
            handleSetScale(entity, getPayload<ActionType.SET_SCALE>(action));
            break;
          }
          case ActionType.RANDOM: {
            handleRandom(entity, getPayload<ActionType.RANDOM>(action));
            break;
          }
          case ActionType.BATCH: {
            handleBatch(entity, getPayload<ActionType.BATCH>(action));
            break;
          }
          case ActionType.HEAL_PLAYER: {
            handleHealPlayer(entity, getPayload<ActionType.HEAL_PLAYER>(action));
            break;
          }
          case ActionType.CLAIM_AIRDROP: {
            handleClaimAirdrop(entity, getPayload<ActionType.CLAIM_AIRDROP>(action));
            break;
          }
          case ActionType.LIGHTS_ON: {
            handleLightsOn(entity);
            break;
          }
          case ActionType.LIGHTS_OFF: {
            handleLightsOff(entity);
            break;
          }
          case ActionType.LIGHTS_MODIFY: {
            handleLightsModify(entity, getPayload<ActionType.LIGHTS_MODIFY>(action));
            break;
          }
          case ActionType.CHANGE_CAMERA: {
            handleChangeCamera(entity, getPayload<ActionType.CHANGE_CAMERA>(action));
            break;
          }
          case ActionType.CHANGE_TEXT: {
            handleChangeText(entity, getPayload<ActionType.CHANGE_TEXT>(action));
            break;
          }
          case ActionType.FREEZE_PLAYER: {
            handleFreezePlayer();
            break;
          }
          case ActionType.UNFREEZE_PLAYER: {
            handleUnfreezePlayer();
            break;
          }
          case ActionType.CHANGE_COLLISIONS: {
            handleChangeCollisions(entity, getPayload<ActionType.CHANGE_COLLISIONS>(action));
            break;
          }
          case ActionType.CHANGE_SKYBOX: {
            handleChangeSkybox(getPayload<ActionType.CHANGE_SKYBOX>(action));
            break;
          }
          case ActionType.RESET_SKYBOX: {
            handleResetSkybox();
            break;
          }
          default:
            break;
        }
      });
    }

    initedEntities.add(entity);
  }

  // LIGHTS_ON
  function handleLightsOn(entity: Entity) {
    const light = LightSource.getMutableOrNull(entity);
    if (light) {
      light.active = true;
    }
  }

  // LIGHTS_OFF
  function handleLightsOff(entity: Entity) {
    const light = LightSource.getMutableOrNull(entity);
    if (light) {
      light.active = false;
    }
  }

  // LIGHTS_MODIFY
  function handleLightsModify(entity: Entity, payload: ActionPayload<ActionType.LIGHTS_MODIFY>) {
    const light = LightSource.getMutableOrNull(entity);
    if (!light) return;
    if (payload.active !== undefined) light.active = payload.active;
    if (payload.color) light.color = payload.color;
    if (payload.intensity !== undefined) light.intensity = payload.intensity;
  }

  // CHANGE_CAMERA
  function handleChangeCamera(entity: Entity, payload: ActionPayload<ActionType.CHANGE_CAMERA>) {
    const target = payload.virtualCameraEntity;

    // If target is explicitly null, remove MainCamera to revert to normal behavior
    if (target === null) {
      if (MainCamera.has(engine.CameraEntity)) {
        MainCamera.deleteFrom(engine.CameraEntity);
      }
      return;
    }

    // If target is undefined, use the entity that owns the Actions component
    // If that entity has VirtualCamera, use it; otherwise revert to normal behavior
    let cameraEntity: Entity | undefined = target;

    if (cameraEntity === undefined) {
      // Use the entity that owns the Actions component if it has VirtualCamera
      if (VirtualCamera.has(entity)) {
        cameraEntity = entity;
      } else {
        // No camera specified and entity doesn't have VirtualCamera, revert to normal
        if (MainCamera.has(engine.CameraEntity)) {
          MainCamera.deleteFrom(engine.CameraEntity);
        }
        return;
      }
    }

    // Ensure the selected entity has VirtualCamera before applying
    if (!VirtualCamera.has(cameraEntity)) {
      return;
    }

    MainCamera.createOrReplace(engine.CameraEntity, {
      virtualCameraEntity: cameraEntity,
    });
  }

  // CHANGE_TEXT
  function handleChangeText(entity: Entity, payload: ActionPayload<ActionType.CHANGE_TEXT>) {
    const text = TextShape.getMutableOrNull(entity);
    if (!text) return;

    text.text = payload.text;
    if (payload.fontSize !== undefined) text.fontSize = payload.fontSize;
    if (payload.color) text.textColor = payload.color;
  }

  // FREEZE_PLAYER
  function handleFreezePlayer() {
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({
        disableAll: true,
      }),
    });
  }

  // UNFREEZE_PLAYER
  function handleUnfreezePlayer() {
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({
        disableAll: false,
      }),
    });
  }

  // CHANGE_COLLISIONS
  function handleChangeCollisions(
    entity: Entity,
    payload: ActionPayload<ActionType.CHANGE_COLLISIONS>,
  ) {
    const { visibleCollisions, invisibleCollisions } = payload;
    const gltf = GltfContainer.getMutableOrNull(entity);
    const meshCollider = MeshCollider.getMutableOrNull(entity);

    if (gltf) {
      if (visibleCollisions !== undefined) {
        gltf.visibleMeshesCollisionMask = visibleCollisions;
      }
      if (invisibleCollisions !== undefined) {
        gltf.invisibleMeshesCollisionMask = invisibleCollisions;
      }
    }

    if (meshCollider) {
      // For MeshCollider, use visibleCollisions if provided, otherwise invisibleCollisions
      if (visibleCollisions !== undefined) {
        meshCollider.collisionMask = visibleCollisions;
      } else if (invisibleCollisions !== undefined) {
        meshCollider.collisionMask = invisibleCollisions;
      }
    }
  }

  // CHANGE_SKYBOX
  function handleChangeSkybox(payload: ActionPayload<ActionType.CHANGE_SKYBOX>) {
    const { time, direction } = payload;

    // Ensure time is a valid number (seconds since midnight)
    if (typeof time !== 'number' || isNaN(time) || time < 0 || time > 86400) {
      console.error('Invalid skybox time value:', time);
      return;
    }

    SkyboxTime.createOrReplace(engine.RootEntity, {
      fixedTime: time,
      transitionMode: direction,
    });
  }

  // RESET_SKYBOX
  function handleResetSkybox() {
    if (SkyboxTime.has(engine.RootEntity)) {
      SkyboxTime.deleteFrom(engine.RootEntity);
    }
  }

  // PLAY_ANIMATION
  function initPlayAnimation(entity: Entity) {
    if (!Animator.has(entity)) {
      Animator.create(entity, {
        states: [],
      });
      Animator.stopAllAnimations(entity);
    }
  }

  function normalizeAnimationWeight(rawWeight: number): number {
    if (rawWeight < 0 || rawWeight > 1) return 1;
    return rawWeight;
  }

  function handlePlayAnimation(entity: Entity, payload: ActionPayload<ActionType.PLAY_ANIMATION>) {
    const { animation, loop, shouldReset } = payload;

    const animator = Animator.getMutable(entity);
    if (!animator.states.some($ => $.clip === animation)) {
      animator.states = [
        ...animator.states,
        {
          clip: animation,
        },
      ];
    }

    Animator.stopAllAnimations(entity);

    try {
      const clip = Animator.getClip(entity, animation);
      clip.playing = true;
      clip.loop = loop ?? false;
      clip.weight = normalizeAnimationWeight(clip.weight ?? 1);
      if (shouldReset !== undefined) {
        clip.shouldReset = shouldReset;
      }
    } catch (e) {
      console.error('Error playing animation', e);
    }
  }

  // STOP_ANIMATION
  function handleStopAnimation(entity: Entity, _payload: ActionPayload<ActionType.STOP_ANIMATION>) {
    if (Animator.has(entity)) {
      Animator.stopAllAnimations(entity);
    }
  }

  // SET_STATE
  function handleSetState(entity: Entity, payload: ActionPayload<ActionType.SET_STATE>) {
    const states = States.getMutableOrNull(entity);

    if (states) {
      const defaultValue = getDefaultValue(states);
      let nextState: string | undefined = payload.state;
      nextState = isValidState(states, nextState) ? nextState : defaultValue;
      const previousValue = states.currentValue ?? defaultValue ?? undefined;
      states.previousValue = previousValue;
      states.currentValue = nextState;

      const triggerEvents = getTriggerEvents(entity);
      triggerEvents.emit(TriggerType.ON_STATE_CHANGE);
    }
  }

  // START_TWEEN
  function handleStartTween(entity: Entity, payload: ActionPayload<ActionType.START_TWEEN>) {
    if (payload) {
      // Get the initial tween if exists to revert the object movement to that sequence when executing a tween from actions
      const initialTween = TweenComponent.getMutableOrNull(entity);
      let tween;

      switch (payload.type) {
        case TweenType.MOVE_ITEM: {
          tween = handleMoveItem(entity, payload);
          break;
        }
        case TweenType.ROTATE_ITEM: {
          tween = handleRotateItem(entity, payload);
          break;
        }
        case TweenType.SCALE_ITEM: {
          tween = handleScaleItem(entity, payload);
          break;
        }
        case TweenType.KEEP_ROTATING_ITEM: {
          tween = handleKeepRotatingItem(entity, payload);
          break;
        }
        default: {
          throw new Error(`Unknown tween type: ${payload.type}`);
        }
      }

      revertTween(entity, initialTween, tween);
    }
  }

  // Restart to the initial movement sequence when executing an aditional tween
  function revertTween(entity: Entity, initialTween: PBTween | null, tween: PBTween) {
    const tweenSequence = TweenSequence.getMutableOrNull(entity);
    let _revertTween = {
      ...tween,
    };

    if (!initialTween || !tweenSequence || !tweenSequence.loop) return;

    switch (initialTween.mode?.$case) {
      case 'move': {
        _revertTween = {
          ..._revertTween,
          mode: Tween.Mode.Move({
            start: (tween.mode as { $case: 'move'; move: Move }).move.end,
            end: initialTween.mode.move.start,
          }),
        };
        break;
      }
      case 'rotate': {
        _revertTween = {
          ..._revertTween,
          mode: Tween.Mode.Rotate({
            start: (tween.mode as { $case: 'rotate'; rotate: Rotate }).rotate.end,
            end: initialTween.mode.rotate.start,
          }),
        };
        break;
      }
      case 'scale': {
        _revertTween = {
          ..._revertTween,
          mode: Tween.Mode.Scale({
            start: (tween.mode as { $case: 'scale'; scale: Scale }).scale.end,
            end: initialTween.mode.scale.start,
          }),
        };
        break;
      }
      default: {
        throw new Error(`Unknown tween mode: ${initialTween.mode}`);
      }
    }

    // If the initial tween is not playing but the loop property is active, start it
    initialTween.playing = true;
    tweenSequence.sequence = [_revertTween, initialTween];
  }

  // MOVE_ITEM
  function handleMoveItem(entity: Entity, tween: ActionPayload<ActionType.START_TWEEN>) {
    const transform = Transform.get(entity);
    const { duration, interpolationType, relative } = tween;
    const end = Vector3.create(tween.end.x, tween.end.y, tween.end.z);
    const endPosition = relative ? Vector3.add(transform.position, end) : end;

    return TweenComponent.createOrReplace(entity, {
      mode: Tween.Mode.Move({
        start: transform.position,
        end: endPosition,
      }),
      duration: duration * 1000, // from secs to ms
      easingFunction: getEasingFunctionFromInterpolation(interpolationType),
    });
  }

  // ROTATE_ITEM
  function handleRotateItem(entity: Entity, tween: ActionPayload<ActionType.START_TWEEN>) {
    const transform = Transform.get(entity);
    const { duration, interpolationType, relative } = tween;
    const end = Quaternion.fromEulerDegrees(tween.end.x, tween.end.y, tween.end.z);
    const endRotation = relative ? Quaternion.multiply(transform.rotation, end) : end;

    return TweenComponent.createOrReplace(entity, {
      mode: Tween.Mode.Rotate({
        start: transform.rotation,
        end: endRotation,
      }),
      duration: duration * 1000, // from secs to ms
      easingFunction: getEasingFunctionFromInterpolation(interpolationType),
    });
  }

  // SCALE_ITEM
  function handleScaleItem(entity: Entity, tween: ActionPayload<ActionType.START_TWEEN>) {
    const transform = Transform.get(entity);
    const { duration, interpolationType, relative } = tween;
    const end = Vector3.create(tween.end.x, tween.end.y, tween.end.z);
    const endScale = relative ? Vector3.add(transform.scale, end) : end;

    return TweenComponent.createOrReplace(entity, {
      mode: Tween.Mode.Scale({
        start: transform.scale,
        end: endScale,
      }),
      duration: duration * 1000, // from secs to ms
      easingFunction: getEasingFunctionFromInterpolation(interpolationType),
    });
  }

  // KEEP_ROTATING_ITEM (continuous rotation)
  function handleKeepRotatingItem(entity: Entity, tween: ActionPayload<ActionType.START_TWEEN>) {
    const { duration, interpolationType } = tween;
    const dir = tween.direction ?? { x: 0, y: 1, z: 0 };
    const speed = tween.speed ?? 1;

    return TweenComponent.createOrReplace(entity, {
      mode: Tween.Mode.RotateContinuous({
        direction: Quaternion.fromEulerDegrees(dir.x, dir.y, dir.z),
        speed,
      }),
      duration: (duration ?? 0) * 1000,
      easingFunction: getEasingFunctionFromInterpolation(interpolationType),
    });
  }

  // STOP_TWEEN
  function handleStopTween(entity: Entity) {
    if (TweenComponent.has(entity)) {
      TweenComponent.deleteFrom(entity);
    }
  }

  // SLIDE_TEXTURE
  function handleSlideTexture(entity: Entity, payload: ActionPayload<ActionType.SLIDE_TEXTURE>) {
    const dir = payload.direction;
    const speed = payload.speed;
    const movementType = payload.movementType as unknown as SdkTextureMovementType | undefined;
    const duration = payload.duration ?? 0;

    return TweenComponent.createOrReplace(entity, {
      mode: Tween.Mode.TextureMoveContinuous({
        direction: { x: dir.x, y: dir.y },
        speed,
        movementType,
      }),
      duration: duration * 1000,
      easingFunction: 0,
    });
  }

  // SET_COUNTER
  function handleSetCounter(entity: Entity, payload: ActionPayload<ActionType.SET_COUNTER>) {
    const counter = Counter.getMutableOrNull(entity);

    if (counter) {
      counter.value = payload.counter;

      const triggerEvents = getTriggerEvents(entity);
      triggerEvents.emit(TriggerType.ON_COUNTER_CHANGE);
    }
  }

  // INCREMENT_COUNTER
  function handleIncrementCounter(
    entity: Entity,
    payload: ActionPayload<ActionType.INCREMENT_COUNTER>,
  ) {
    const counter = Counter.getMutableOrNull(entity);
    const amount = payload.amount ?? 1;

    if (counter) {
      counter.value += amount;

      const triggerEvents = getTriggerEvents(entity);
      triggerEvents.emit(TriggerType.ON_COUNTER_CHANGE);
    }
  }

  // DECREASE_COUNTER
  function handleDecreaseCounter(
    entity: Entity,
    payload: ActionPayload<ActionType.INCREMENT_COUNTER>,
  ) {
    const counter = Counter.getMutableOrNull(entity);
    const amount = payload.amount ?? 1;

    if (counter) {
      counter.value -= amount;

      const triggerEvents = getTriggerEvents(entity);
      triggerEvents.emit(TriggerType.ON_COUNTER_CHANGE);
    }
  }

  // PLAY_SOUND
  function handlePlaySound(entity: Entity, payload: ActionPayload<ActionType.PLAY_SOUND>) {
    const { src, loop, volume, global } = payload;
    if (AudioSource.has(entity)) {
      AudioSource.playSound(entity, src);
      const audioSource = AudioSource.getMutable(entity);
      audioSource.loop = loop;
      audioSource.volume = volume ?? 1;
      audioSource.global = global ?? false;
    } else {
      AudioSource.create(entity, {
        audioClipUrl: src,
        loop,
        playing: true,
        volume: volume ?? 1,
        global,
      });
    }
  }

  // STOP_SOUND
  function handleStopSound(entity: Entity, _payload: ActionPayload<ActionType.STOP_SOUND>) {
    const audioSource = AudioSource.getMutableOrNull(entity);
    if (audioSource) {
      audioSource.playing = false;
    }
  }

  // SET_VISIBILITY
  function handleSetVisibility(entity: Entity, payload: ActionPayload<ActionType.SET_VISIBILITY>) {
    const { visible, collider } = payload;
    VisibilityComponent.createOrReplace(entity, { visible });
    const gltf = GltfContainer.getMutableOrNull(entity);
    const meshCollider = MeshCollider.getMutableOrNull(entity);

    if (collider !== undefined) {
      if (gltf) {
        gltf.invisibleMeshesCollisionMask = collider;
        if (collider === 0) {
          gltf.visibleMeshesCollisionMask = 0;
        }
      } else if (meshCollider) {
        meshCollider.collisionMask = collider;
      }
    }
  }

  // ATTACH_TO_PLAYER
  function handleAttachToPlayer(
    entity: Entity,
    payload: ActionPayload<ActionType.ATTACH_TO_PLAYER>,
  ) {
    const { anchorPointId } = payload;
    const user = playersHelper?.getPlayer()?.userId;
    if (user) {
      AvatarAttach.createOrReplace(entity, { anchorPointId: anchorPointId, avatarId: user });
    }
  }

  // DETACH_FROM_PLAYER
  function handleDetachFromPlayer(
    entity: Entity,
    _payload: ActionPayload<ActionType.DETACH_FROM_PLAYER>,
  ) {
    if (AvatarAttach.has(entity)) {
      AvatarAttach.deleteFrom(entity);
    }
  }

  // TELEPORT PLAYER
  function handleTeleportPlayer(
    _entity: Entity,
    payload: ActionPayload<ActionType.TELEPORT_PLAYER>,
  ) {
    const { x, y } = payload;
    requestTeleport({
      destination: `${x},${y}`,
    });
  }

  // MOVE PLAYER
  function handleMovePlayer(_entity: Entity, payload: ActionPayload<ActionType.MOVE_PLAYER>) {
    const options = {
      newRelativePosition: payload.position,
      cameraTarget: payload.cameraTarget,
    };
    void movePlayerTo(options);
  }

  // PLAY DEFAULT EMOTE
  function handlePlayDefaultEmote(
    _entity: Entity,
    payload: ActionPayload<ActionType.PLAY_DEFAULT_EMOTE>,
  ) {
    const { emote } = payload;
    void triggerEmote({ predefinedEmote: emote });
  }

  // PLAY CUSTOM EMOTE
  function handlePlayCustomEmote(
    _entity: Entity,
    payload: ActionPayload<ActionType.PLAY_CUSTOM_EMOTE>,
  ) {
    const { src, loop } = payload;
    void triggerSceneEmote({ src, loop });
  }

  // OPEN LINK
  function handleOpenLink(_entity: Entity, payload: ActionPayload<ActionType.OPEN_LINK>) {
    const { url } = payload;
    void openExternalUrl({ url });
  }

  // PLAY_VIDEO
  function handlePlayVideo(entity: Entity, payload: ActionPayload<ActionType.PLAY_VIDEO_STREAM>) {
    const videoSource = VideoPlayer.getMutableOrNull(entity);
    if (!videoSource && payload.src) {
      VideoPlayer.createOrReplace(entity, {
        src: payload.src,
        volume: payload.volume ?? 1,
        loop: payload.loop ?? false,
        playing: true,
      });

      // Init video player material when the entity doesn't have a VideoPlayer component defined
      initVideoPlayerComponentMaterial(entity, { Material }, Material.getOrNull(entity));
    }
    if (videoSource) {
      if (videoSource?.src !== payload.src) {
        videoSource.src = payload.src ?? '';
      }
      videoSource.volume = payload.volume ?? videoSource.volume;
      videoSource.loop = payload.loop ?? videoSource.loop;
      videoSource.playing = true;
    }
  }
  // STOP_VIDEO
  function handleStopVideo(entity: Entity, _payload: ActionPayload<ActionType.STOP_VIDEO_STREAM>) {
    const videoSource = VideoPlayer.getMutableOrNull(entity);
    if (videoSource) {
      videoSource.playing = false;
    }
  }

  // PLAY_AUDIO_STREAM
  function handlePlayAudioStream(
    entity: Entity,
    payload: ActionPayload<ActionType.PLAY_AUDIO_STREAM>,
  ) {
    const { url, volume } = payload;
    AudioStream.createOrReplace(entity, {
      url,
      playing: true,
      volume: volume ?? 1,
    });
  }

  // STOP_AUDIO_STREAM
  function handleStopAudioStream(
    entity: Entity,
    _payload: ActionPayload<ActionType.STOP_AUDIO_STREAM>,
  ) {
    const audioSource = AudioStream.getMutableOrNull(entity);
    if (audioSource) {
      audioSource.playing = false;
    }
  }

  // SHOW_TEXT
  function handleShowText(entity: Entity, payload: ActionPayload<ActionType.SHOW_TEXT>) {
    const { text, hideAfterSeconds, font, fontSize, textAlign } = payload;
    // Create a new entity for the text
    const textEntity = engine.addEntity();
    // Set the text entity as a child of the entity that called the action
    textEntities.set(entity, textEntity);
    const uiTransformComponent = getUITransform(UiTransform, textEntity);
    if (uiTransformComponent) {
      uiTransformComponent.parent = entity;
      // Set the pointer filter to none, allowing players to continue interacting with the scene
      uiTransformComponent.pointerFilter = PointerFilterMode.PFM_NONE;
      UiText.createOrReplace(textEntity, {
        value: text,
        font: font as unknown as Font,
        fontSize,
        textAlign: textAlign as unknown as TextAlignMode,
      });
      startTimeout(entity, ActionType.HIDE_TEXT, hideAfterSeconds, () =>
        handleHideText(entity, {}),
      );
    }
  }

  // HIDE_TEXT
  function handleHideText(entity: Entity, _payload: ActionPayload<ActionType.HIDE_TEXT>) {
    const textEntity = textEntities.get(entity);
    if (textEntity) {
      // Delete text component
      UiText.deleteFrom(textEntity);
      // Delete transform component
      UiTransform.deleteFrom(textEntity);
      // Clear timeout if it exists
      stopTimeout(entity, ActionType.HIDE_TEXT);
      // Delete text entity from the map
      textEntities.delete(entity);
    }
  }

  function findActionByName(entity: Entity, name: string) {
    const actions = Actions.getOrNull(entity);
    return actions?.value.find($ => $.name === name);
  }

  // START_DELAY
  function handleStartDelay(entity: Entity, payload: ActionPayload<ActionType.START_DELAY>) {
    const { actions, timeout } = payload;
    for (const actionName of actions) {
      const action = findActionByName(entity, actionName);
      if (action) {
        startTimeout(entity, actionName, timeout, () => {
          const actionEvents = getActionEvents(entity);
          actionEvents.emit(action.name, getPayload(action));
        });
      }
    }
  }

  // STOP_DELAY
  function handleStopDelay(entity: Entity, payload: ActionPayload<ActionType.STOP_DELAY>) {
    const { action } = payload;
    stopTimeout(entity, action);
  }

  // START_LOOP
  function handleStartLoop(entity: Entity, payload: ActionPayload<ActionType.START_LOOP>) {
    const { actions, interval } = payload;
    for (const actionName of actions) {
      const action = findActionByName(entity, actionName);
      if (action) {
        startInterval(entity, actionName, interval, () => {
          const actionEvents = getActionEvents(entity);
          actionEvents.emit(action.name, getPayload(action));
        });
      }
    }
  }

  // STOP_LOOP
  function handleStopLoop(entity: Entity, payload: ActionPayload<ActionType.STOP_LOOP>) {
    const { action } = payload;
    stopInterval(entity, action);
  }

  // CLONE_ENTITY
  function handleCloneEntity(entity: Entity, payload: ActionPayload<ActionType.CLONE_ENTITY>) {
    const { position } = payload;

    // clone entity
    const { cloned, entities } = clone(entity, engine, Transform, Triggers, sdkHelpers);
    for (const cloned of entities.values()) {
      // initialize
      initActions(cloned);
      initTriggers(cloned);

      const triggerEvents = getTriggerEvents(cloned);
      triggerEvents.emit(TriggerType.ON_CLONE);
    }

    const transform = Transform.getOrCreateMutable(cloned);
    transform.position = position;
  }

  // REMOVE_ENTITY
  function handleRemoveEntity(entity: Entity, _payload: ActionPayload<ActionType.REMOVE_ENTITY>) {
    // Remove all timers before remove the entity
    stopAllTimeouts(entity);
    stopAllIntervals(entity);

    const tree = getComponentEntityTree(engine, entity, Transform);
    for (const entityToRemove of tree) {
      engine.removeEntity(entityToRemove);
    }
  }

  function getUiStack(align: ScreenAlignMode) {
    const key = `${align.alignItems},${align.justifyContent}`;

    if (!uiStacks.has(key)) {
      uiStacks.set(key, engine.addEntity());
    }

    return uiStacks.get(key)!;
  }

  // SHOW_IMAGE
  function handleShowImage(entity: Entity, payload: ActionPayload<ActionType.SHOW_IMAGE>) {
    const { src, text, hideAfterSeconds, fontSize, align, height, width } = payload;

    // Get/Create a UI transform for the root entity
    getUITransform(UiTransform, engine.RootEntity);

    // Get a UI Stack entity
    const screenAlign = mapAlignToScreenAlign(align);
    const uiStack = getUiStack(screenAlign);

    // TODO: Fix items wrapping
    // Get/Create a UI Transform for the UI stack
    const uiStackTransformComponent = getUITransform(UiTransform, uiStack);
    uiStackTransformComponent.alignItems = screenAlign.alignItems;
    uiStackTransformComponent.justifyContent = screenAlign.justifyContent;
    uiStackTransformComponent.positionType = YGPositionType.YGPT_ABSOLUTE;

    // Create a UI entity and a Transform component for the image
    const imageEntity = engine.addEntity();
    const imageTransformComponent = getUITransform(
      UiTransform,
      imageEntity,
      width,
      height,
      YGUnit.YGU_POINT,
    );
    imageTransformComponent.parent = uiStack;
    imageTransformComponent.pointerFilter = PointerFilterMode.PFM_BLOCK;

    // Create Background Component
    getUIBackground(UiBackground, imageEntity, src);

    if (text) {
      // Create Text Component
      // TODO: Fix text wrapping and scrolling
      getUIText(UiText, imageEntity, text, fontSize, width);
    }

    pointerEventsSystem.onPointerDown(
      {
        entity: imageEntity,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: 'Click',
        },
      },
      () => {
        lastUiEntityClicked.set(entity, imageEntity);
        const triggerEvents = getTriggerEvents(entity);
        triggerEvents.emit(TriggerType.ON_CLICK_IMAGE);
      },
    );

    if (hideAfterSeconds) {
      startTimeout(entity, ActionType.HIDE_IMAGE, hideAfterSeconds, () =>
        handleHideImage(entity, { imageEntity: imageEntity }),
      );
    }
  }

  // HIDE_IMAGE
  function handleHideImage(entity: Entity, payload: ActionPayload<ActionType.HIDE_IMAGE>) {
    const { imageEntity } = payload;

    if (imageEntity) {
      engine.removeEntity(imageEntity as Entity);
    } else {
      const clickedImage = lastUiEntityClicked.get(entity);
      if (clickedImage) {
        engine.removeEntity(clickedImage);
        lastUiEntityClicked.delete(entity);
      }
    }
  }

  // DAMAGE
  function handleDamage(entity: Entity, payload: ActionPayload<ActionType.DAMAGE>) {
    const { radius, layer, hits } = payload;
    const entityPosition = AvatarAttach.has(entity)
      ? getPlayerPosition()
      : getWorldPosition(entity);

    const getRoot = (entity: Entity): Entity => {
      const parent = getEntityParent(entity);
      return !parent ? entity : getRoot(parent);
    };

    for (const target of damageTargets) {
      const targetPosition = getWorldPosition(target);
      const distance = Vector3.distance(entityPosition, targetPosition);

      // avoid causing damage to the entity itself or its children
      const entityTree = Array.from(getComponentEntityTree(engine, entity, Transform));
      const isPartOfEntityTree = entityTree.some($ => $ === target);
      if (isPartOfEntityTree) {
        continue;
      }

      if (layer) {
        if (layer === ProximityLayer.PLAYER) {
          const root = getRoot(target);
          if (root !== engine.PlayerEntity && root !== engine.CameraEntity) {
            continue;
          }
        } else if (layer === ProximityLayer.NON_PLAYER) {
          const root = getRoot(target);
          if (root === engine.PlayerEntity || root === engine.CameraEntity) {
            continue;
          }
        }
      }
      if (distance <= radius) {
        const total = hits === undefined ? 1 : Math.max(hits, 1);
        for (let i = 0; i < total; i++) {
          const triggerEvents = getTriggerEvents(target);
          triggerEvents.emit(TriggerType.ON_DAMAGE);
        }
      }
    }
  }

  // MOVE_PLAYER_HERE
  function handleMovePlayerHere(
    entity: Entity,
    _payload: ActionPayload<ActionType.MOVE_PLAYER_HERE>,
  ) {
    const here = getWorldPosition(entity);
    const rotation = getWorldRotation(entity);

    // We Want the player to look 1m in front of the entity
    const forward = Vector3.Forward();
    const rotatedDirection = Vector3.rotate(forward, rotation);
    const moveDelta = Vector3.scale(rotatedDirection, 1);

    void movePlayerTo({
      newRelativePosition: here,
      avatarTarget: Vector3.add(here, moveDelta),
    });

    const triggerEvents = getTriggerEvents(entity);
    triggerEvents.emit(TriggerType.ON_PLAYER_SPAWN);
  }

  // PLAYER_FACE_ITEM
  function handlePlayerFaceItem(
    entity: Entity,
    _payload: ActionPayload<ActionType.PLAYER_FACE_ITEM>,
  ) {
    const itemPosition = getWorldPosition(entity);
    const currentPlayerPosition = getPlayerPosition();
    void movePlayerTo({
      newRelativePosition: currentPlayerPosition,
      avatarTarget: itemPosition,
    });
  }

  // PLACE_ON_PLAYER
  function handlePlaceOnPlayer(
    entity: Entity,
    _payload: ActionPayload<ActionType.PLACE_ON_PLAYER>,
  ) {
    const transform = Transform.getMutableOrNull(entity);
    const player = Transform.getOrNull(engine.PlayerEntity);
    if (transform && player) {
      transform.position = player.position;
    }
  }

  // ROTATE_AS_PLAYER
  function handleRotateAsPlayer(
    entity: Entity,
    _payload: ActionPayload<ActionType.ROTATE_AS_PLAYER>,
  ) {
    const transform = Transform.getMutableOrNull(entity);
    const player = Transform.getOrNull(engine.PlayerEntity);
    if (transform && player) {
      transform.rotation = player.rotation;
    }
  }

  // PLACE_ON_CAMERA
  function handlePlaceOnCamera(
    entity: Entity,
    _payload: ActionPayload<ActionType.PLACE_ON_CAMERA>,
  ) {
    const transform = Transform.getMutableOrNull(entity);
    const camera = Transform.getOrNull(engine.CameraEntity);
    if (transform && camera) {
      transform.position = camera.position;
    }
  }

  // ROTATE_AS_CAMERA
  function handleRotateAsCamera(
    entity: Entity,
    _payload: ActionPayload<ActionType.ROTATE_AS_CAMERA>,
  ) {
    const transform = Transform.getMutableOrNull(entity);
    const camera = Transform.getOrNull(engine.CameraEntity);
    if (transform && camera) {
      transform.rotation = camera.rotation;
    }
  }

  // SET_POSITION
  function handleSetPosition(entity: Entity, payload: ActionPayload<ActionType.SET_POSITION>) {
    const transform = Transform.getMutableOrNull(entity);
    if (transform) {
      if (payload.relative) {
        transform.position = Vector3.add(
          transform.position,
          Vector3.create(payload.x, payload.y, payload.z),
        );
      } else {
        transform.position = Vector3.create(payload.x, payload.y, payload.z);
      }
    }
  }

  // SET_ROTATION
  function handleSetRotation(entity: Entity, payload: ActionPayload<ActionType.SET_ROTATION>) {
    const transform = Transform.getMutableOrNull(entity);
    if (transform) {
      if (payload.relative) {
        transform.rotation = Quaternion.multiply(
          transform.rotation,
          Quaternion.fromEulerDegrees(payload.x, payload.y, payload.z),
        );
      } else {
        transform.rotation = Quaternion.fromEulerDegrees(payload.x, payload.y, payload.z);
      }
    }
  }

  // SET_SCALE
  function handleSetScale(entity: Entity, payload: ActionPayload<ActionType.SET_SCALE>) {
    const transform = Transform.getMutableOrNull(entity);
    if (transform) {
      if (payload.relative) {
        transform.scale = Vector3.add(
          transform.scale,
          Vector3.create(payload.x, payload.y, payload.z),
        );
      } else {
        transform.scale = Vector3.create(payload.x, payload.y, payload.z);
      }
    }
  }

  // FOLLOW_PLAYER
  function handleFollowPlayer(entity: Entity, payload: ActionPayload<ActionType.FOLLOW_PLAYER>) {
    const { speed, x, y, z, minDistance } = payload;
    followMap.set(entity, {
      target: engine.PlayerEntity,
      speed,
      minDistance,
      axes: { x, y, z },
    });
  }

  // STOP_FOLLOWING_PLAYER
  function handleStopFollowingPlayer(
    entity: Entity,
    _payload: ActionPayload<ActionType.STOP_FOLLOWING_PLAYER>,
  ) {
    followMap.delete(entity);
  }

  function handleRandom(entity: Entity, payload: ActionPayload<ActionType.RANDOM>) {
    const { actions } = payload;
    const actionEvents = getActionEvents(entity);
    const actionName = actions[Math.floor(Math.random() * actions.length)];
    const action = findActionByName(entity, actionName);
    if (action) {
      actionEvents.emit(action.name, getPayload(action));
    }
  }

  function handleBatch(entity: Entity, payload: ActionPayload<ActionType.BATCH>) {
    const { actions } = payload;
    const actionEvents = getActionEvents(entity);
    for (const actionName of actions) {
      const action = findActionByName(entity, actionName);
      if (action) {
        actionEvents.emit(action.name, getPayload(action));
      }
    }
  }

  function handleHealPlayer(entity: Entity, payload: ActionPayload<ActionType.HEAL_PLAYER>) {
    const { multiplier } = payload;

    const getRoot = (entity: Entity): Entity => {
      const parent = getEntityParent(entity);
      return !parent ? entity : getRoot(parent);
    };

    for (const target of healTargets) {
      const root = getRoot(target);
      if (root === engine.PlayerEntity) {
        const triggerEvents = getTriggerEvents(target);
        const total = Math.max(multiplier ?? 1, 1);
        for (let i = 0; i < total; i++) {
          triggerEvents.emit(TriggerType.ON_HEAL_PLAYER);
        }
      }
    }
  }

  async function request(url: string, init?: FlatFetchInit) {
    try {
      const response = await signedFetch({
        url: url,
        ...(init ? { init } : {}),
      });
      if (!response || !response.body) {
        // TODO: Show an error Prompt
        // 'Error fetching campaign data'
        return null;
      }

      const json = await JSON.parse(response.body);

      if (!json.ok) {
        // TODO: Show an error Prompt
        // 'Error fetching campaign data'
        return null;
      }

      return json.data;
    } catch (error) {
      // TODO: Show an error Prompt
      // 'Error fetching campaign data'
      return null;
    }
  }

  async function fetchCampaignsByDispenserKey(dispenserKey: string) {
    const url = `${REWARDS_SERVER_URL}/api/campaigns/keys?campaign_key=${encodeURIComponent(dispenserKey)}`;
    const response = await request(url);
    return response;
  }

  async function fetchCaptcha() {
    const response = await request(`${REWARDS_SERVER_URL}/api/captcha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response;
  }

  async function requestToken(
    dispenserKey: string,
    captcha?: {
      id: string;
      value: string;
    },
  ) {
    const url = `${REWARDS_SERVER_URL}/api/rewards`;
    const realm = await getRealm({});
    const player = playersHelper?.getPlayer();

    const response = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaign_key: dispenserKey,
        beneficiary: !player?.isGuest ? player?.userId : '',
        catalyst: realm.realmInfo ? realm.realmInfo.baseUrl : '',
        ...(captcha ? { captcha_id: captcha.id, captcha_value: captcha.value } : {}),
      }),
    });
    return response;
  }

  function handleClaimAirdrop(entity: Entity, _payload: ActionPayload<ActionType.CLAIM_AIRDROP>) {
    const rewards = Rewards.getOrNull(entity);
    if (!rewards) {
      return;
    }

    const { testMode, campaignId, dispenserKey } = rewards;

    if (testMode) {
      // TODO: Show an UI indicating testing mode
      // 'Handle Claim Airdrop in Test Mode :)'
      return;
    }

    fetchCampaignsByDispenserKey(dispenserKey)
      .then(campaigns => {
        const campaign = campaigns.find((c: any) => c.campaign_id === campaignId);
        if (campaign && campaign.enabled) {
          if (campaign.requires_captcha) {
            fetchCaptcha()
              .then(captcha => {
                if (captcha) {
                  _showCaptchaPrompt(entity, {
                    campaignId,
                    dispenserKey,
                    captcha,
                  });
                }
              })
              .catch(_error => {
                // TODO: Show an error Prompt
                // 'Error fetching captcha'
              });
          } else {
            requestToken(dispenserKey);
          }
        }
      })
      .catch(_error => {
        // TODO: Show an error Prompt
        // 'Error fetching campaign data', error
      });
  }

  function _showCaptchaPrompt(
    _entity: Entity,
    data: { campaignId: string; dispenserKey: string; captcha: any },
  ) {
    showCaptchaPrompt(
      engine,
      UiTransform,
      UiBackground,
      UiText,
      UiInput,
      UiInputResult,
      pointerEventsSystem,
      data,
      inputText => {
        // Request token with captcha validation
        requestToken(data.dispenserKey, {
          id: data.captcha.id,
          value: inputText,
        }).then((token: any) => {
          if (token) {
            // 'Token requested successfully', { token }
          }
        });
      },
    );
  }
}
