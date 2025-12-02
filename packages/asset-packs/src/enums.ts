import type { YGAlign, YGJustify } from '@dcl/ecs';

export enum ComponentName {
  ACTION_TYPES = 'asset-packs::ActionTypes',
  ACTIONS = 'asset-packs::Actions',
  COUNTER = 'asset-packs::Counter',
  TRIGGERS = 'asset-packs::Triggers',
  STATES = 'asset-packs::States',
  COUNTER_BAR = 'asset-packs::CounterBar',
  ADMIN_TOOLS = 'asset-packs::AdminTools',
  VIDEO_SCREEN = 'asset-packs::VideoScreen',
  REWARDS = 'asset-packs::Rewards',
  TEXT_ANNOUNCEMENTS = 'asset-packs::TextAnnouncements',
  VIDEO_CONTROL_STATE = 'asset-packs::VideoControlState',
  SCRIPT = 'asset-packs::Script',
}

export enum TweenType {
  MOVE_ITEM = 'move_item',
  ROTATE_ITEM = 'rotate_item',
  SCALE_ITEM = 'scale_item',
  KEEP_ROTATING_ITEM = 'keep_rotating_item',
}

export enum InterpolationType {
  LINEAR = 'linear',
  EASEINQUAD = 'easeinquad',
  EASEOUTQUAD = 'easeoutquad',
  EASEQUAD = 'easequad',
  EASEINSINE = 'easeinsine',
  EASEOUTSINE = 'easeoutsine',
  EASESINE = 'easeinoutsine',
  EASEINEXPO = 'easeinexpo',
  EASEOUTEXPO = 'easeoutexpo',
  EASEEXPO = 'easeinoutexpo',
  EASEINELASTIC = 'easeinelastic',
  EASEOUTELASTIC = 'easeoutelastic',
  EASEELASTIC = 'easeinoutelastic',
  EASEINBOUNCE = 'easeinbounce',
  EASEOUTEBOUNCE = 'easeoutbounce',
  EASEBOUNCE = 'easeinoutbounce',
}

export enum ActionType {
  PLAY_ANIMATION = 'play_animation',
  STOP_ANIMATION = 'stop_animation',
  SET_STATE = 'set_state',
  START_TWEEN = 'start_tween',
  SET_COUNTER = 'set_counter',
  INCREMENT_COUNTER = 'increment_counter',
  DECREASE_COUNTER = 'decrease_counter',
  PLAY_SOUND = 'play_sound',
  STOP_SOUND = 'stop_sound',
  SET_VISIBILITY = 'set_visibility',
  ATTACH_TO_PLAYER = 'attach_to_player',
  DETACH_FROM_PLAYER = 'detach_from_player',
  PLAY_VIDEO_STREAM = 'play_video_stream',
  STOP_VIDEO_STREAM = 'stop_video_stream',
  PLAY_AUDIO_STREAM = 'play_audio_stream',
  STOP_AUDIO_STREAM = 'stop_audio_stream',
  TELEPORT_PLAYER = 'teleport_player',
  MOVE_PLAYER = 'move_player',
  PLAY_DEFAULT_EMOTE = 'play_default_emote',
  PLAY_CUSTOM_EMOTE = 'play_custom_emote',
  OPEN_LINK = 'open_link',
  SHOW_TEXT = 'show_text',
  HIDE_TEXT = 'hide_text',
  START_DELAY = 'start_delay',
  STOP_DELAY = 'stop_delay',
  START_LOOP = 'start_loop',
  STOP_LOOP = 'stop_loop',
  CLONE_ENTITY = 'clone_entity',
  REMOVE_ENTITY = 'remove_entity',
  SHOW_IMAGE = 'show_image',
  HIDE_IMAGE = 'hide_image',
  DAMAGE = 'damage',
  MOVE_PLAYER_HERE = 'move_player_here',
  PLACE_ON_PLAYER = 'place_on_player',
  ROTATE_AS_PLAYER = 'rotate_as_player',
  PLACE_ON_CAMERA = 'place_on_camera',
  ROTATE_AS_CAMERA = 'rotate_as_camera',
  SET_POSITION = 'set_position',
  SET_ROTATION = 'set_rotation',
  SET_SCALE = 'set_scale',
  FOLLOW_PLAYER = 'follow_player',
  STOP_FOLLOWING_PLAYER = 'stop_following_player',
  RANDOM = 'random',
  BATCH = 'batch',
  HEAL_PLAYER = 'heal_player',
  CLAIM_AIRDROP = 'claim_airdrop',
  LIGHTS_ON = 'lights_on',
  LIGHTS_OFF = 'lights_off',
  LIGHTS_MODIFY = 'lights_modify',
  CHANGE_CAMERA = 'change_camera',
  CHANGE_TEXT = 'change_text',
  STOP_TWEEN = 'stop_tween',
  SLIDE_TEXTURE = 'slide_texture',
}

export enum TriggerType {
  /** @deprecated use ON_INPUT_ACTION instead */
  ON_CLICK = 'on_click',
  ON_INPUT_ACTION = 'on_input_action',
  ON_STATE_CHANGE = 'on_state_change',
  ON_SPAWN = 'on_spawn',
  ON_TWEEN_END = 'on_tween_end',
  ON_COUNTER_CHANGE = 'on_counter_change',
  ON_PLAYER_ENTERS_AREA = 'on_player_enters_area',
  ON_PLAYER_LEAVES_AREA = 'on_player_leaves_area',
  ON_DELAY = 'on_delay',
  ON_LOOP = 'on_loop',
  ON_CLONE = 'on_clone',
  ON_CLICK_IMAGE = 'on_click_image',
  ON_DAMAGE = 'on_damage',
  ON_GLOBAL_CLICK = 'on_global_click',
  ON_GLOBAL_PRIMARY = 'on_global_primary',
  ON_GLOBAL_SECONDARY = 'on_global_secondary',
  ON_TICK = 'on_tick',
  ON_HEAL_PLAYER = 'on_heal_player',
  ON_PLAYER_SPAWN = 'on_player_spawn',
}

export enum TriggerConditionType {
  WHEN_STATE_IS = 'when_state_is',
  WHEN_STATE_IS_NOT = 'when_state_is_not',
  WHEN_COUNTER_EQUALS = 'when_counter_equals',
  WHEN_COUNTER_IS_GREATER_THAN = 'when_counter_is_greater_than',
  WHEN_COUNTER_IS_LESS_THAN = 'when_counter_is_less_than',
  WHEN_DISTANCE_TO_PLAYER_LESS_THAN = 'when_distance_to_player_less_than',
  WHEN_DISTANCE_TO_PLAYER_GREATER_THAN = 'when_distance_to_player_greater_than',
  WHEN_PREVIOUS_STATE_IS = 'when_previous_state_is',
  WHEN_PREVIOUS_STATE_IS_NOT = 'when_previous_state_is_not',
}

export enum TriggerConditionOperation {
  AND = 'and',
  OR = 'or',
}

// Defined values instead of using from @dcl/ecs because Schemas doesn't support const enums
export enum AlignMode {
  TAM_TOP_LEFT = 0,
  TAM_TOP_CENTER = 1,
  TAM_TOP_RIGHT = 2,
  TAM_MIDDLE_LEFT = 3,
  TAM_MIDDLE_CENTER = 4,
  TAM_MIDDLE_RIGHT = 5,
  TAM_BOTTOM_LEFT = 6,
  TAM_BOTTOM_CENTER = 7,
  TAM_BOTTOM_RIGHT = 8,
}

// Defined values instead of using from @dcl/ecs because Schemas doesn't support const enums
export enum Font {
  F_SANS_SERIF = 0,
  F_SERIF = 1,
  F_MONOSPACE = 2,
}

export type ScreenAlignMode = {
  alignItems: YGAlign;
  justifyContent: YGJustify;
};

// Defined values instead of using from @dcl/ecs because Schemas doesn't support const enums
export enum Colliders {
  /** CL_NONE - no collisions */
  CL_NONE = 0,
  /** CL_POINTER - collisions with the player's pointer ray (e.g. mouse cursor hovering) */
  CL_POINTER = 1,
  /** CL_PHYSICS - collision affecting your player's physics i.e. walls, floor, moving platfroms */
  CL_PHYSICS = 2,
  CL_RESERVED1 = 4,
  CL_RESERVED2 = 8,
  CL_RESERVED3 = 16,
  CL_RESERVED4 = 32,
  CL_RESERVED5 = 64,
  CL_RESERVED6 = 128,
  CL_CUSTOM1 = 256,
  CL_CUSTOM2 = 512,
  CL_CUSTOM3 = 1024,
  CL_CUSTOM4 = 2048,
  CL_CUSTOM5 = 4096,
  CL_CUSTOM6 = 8192,
  CL_CUSTOM7 = 16384,
  CL_CUSTOM8 = 32768,
}

// Defined values instead of using from @dcl/ecs because Schemas doesn't support const enums
export enum TextureMovementType {
  /** default = TextureMovementType.TMT_OFFSET */
  TMT_OFFSET = 0,
  TMT_TILING = 1,
}

export enum ProximityLayer {
  ALL = 'all',
  PLAYER = 'player',
  NON_PLAYER = 'non_player',
}

export enum AdminPermissions {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum MediaSource {
  VideoURL,
  LiveStream,
}
