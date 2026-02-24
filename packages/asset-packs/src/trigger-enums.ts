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
