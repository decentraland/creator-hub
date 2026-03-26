import type { AssetComposite } from '../types';
import {
  getComponent,
  getComponentData,
  hasComponent,
  hasPointerCollider,
  hasAnyCollisionMask,
  getRuntimeCreatedComponents,
} from './helpers';

type Component = AssetComposite['components'][number];

export type ValidationError = {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
};

type Rule = {
  name: string;
  validate: (components: Component[], assetName: string) => ValidationError[];
};

export const rules: Rule[] = [
  // ─── Tier 1: Critical ────────────────────────────────────────────────

  // Rule 1: PointerEvents or click triggers require a collider with CL_POINTER
  {
    name: 'pointer-events-requires-collider',
    validate(components, assetName) {
      const hasPointerEvents = hasComponent(components, 'core::PointerEvents');
      const triggers = getComponentData(components, 'asset-packs::Triggers');
      const hasClickTrigger = triggers?.value?.some(
        (t: any) => t.type === 'on_input_action' || t.type === 'on_click',
      );

      if ((hasPointerEvents || hasClickTrigger) && !hasPointerCollider(components)) {
        return [
          {
            rule: 'pointer-events-requires-collider',
            message: `"${assetName}" has PointerEvents or click trigger but no collider with CL_POINTER`,
            severity: 'error',
          },
        ];
      }
      return [];
    },
  },

  // Rule 2: Invisible items (visibility:false) that act as colliders need collision masks > 0
  // Skip items that start hidden and become visible via set_visibility action
  {
    name: 'invisible-collider-needs-collision-mask',
    validate(components, assetName) {
      const visibility = getComponentData(components, 'core::VisibilityComponent');
      if (!visibility || visibility.visible !== false) return [];

      const gltf = getComponentData(components, 'core::GltfContainer');
      if (!gltf) return [];

      // Check if ANY entity in the composite has set_visibility action
      // (multi-entity composites may have actions on a different entity than the visibility)
      const actionsComponent = getComponent(components, 'asset-packs::Actions');
      if (actionsComponent) {
        const allEntities = Object.values(actionsComponent.data);
        const hasSetVisibility = allEntities.some((entity: any) =>
          entity?.json?.value?.some((a: any) => a.type === 'set_visibility'),
        );
        if (hasSetVisibility) return [];
      }

      // Items with triggers/actions are likely controlled by other entities at runtime
      const actions = getComponentData(components, 'asset-packs::Actions');
      const triggers = getComponentData(components, 'asset-packs::Triggers');
      const hasTriggersOrActions = triggers?.value?.length > 0 || actions?.value?.length > 0;
      if (hasTriggersOrActions) return [];

      if (!hasAnyCollisionMask(components)) {
        return [
          {
            rule: 'invisible-collider-needs-collision-mask',
            message: `"${assetName}" has VisibilityComponent(visible:false) + GltfContainer but no collision masks — it has no effect at runtime`,
            severity: 'error',
          },
        ];
      }
      return [];
    },
  },

  // Rule 3: Sync-Components must reference components that exist in the composite
  // Components created dynamically at runtime by actions (Animator, AudioSource, etc.) are allowed
  // Numeric component IDs (used by Script items) are skipped since they can't be resolved here
  {
    name: 'sync-components-must-exist',
    validate(components, assetName) {
      const syncData = getComponentData(components, 'core-schema::Sync-Components');
      if (!syncData) return [];

      const syncList: string[] = syncData.value ?? syncData.componentIds ?? [];
      const runtimeComponents = getRuntimeCreatedComponents(components);

      // Components that can be created by actions from OTHER entities targeting this one
      const EXTERNALLY_CREATED_COMPONENTS = new Set([
        'core::VisibilityComponent', // set_visibility from another entity
        'core::AudioSource', // play_sound from another entity
        'core::Animator', // play_animation from another entity
        'core::AudioStream', // play_audio_stream from another entity
        'core::VideoPlayer', // play_video_stream from another entity
        'core::PointerEvents', // created by trigger system for on_click/on_input_action
      ]);

      const errors: ValidationError[] = [];

      for (const name of syncList) {
        // Skip numeric IDs (used by Script-based items like Clap Meter, Wearable Scanner)
        if (/^\d+$/.test(name)) continue;

        if (
          !hasComponent(components, name) &&
          !runtimeComponents.has(name) &&
          !EXTERNALLY_CREATED_COMPONENTS.has(name)
        ) {
          errors.push({
            rule: 'sync-components-must-exist',
            message: `"${assetName}" syncs "${name}" but that component doesn't exist in the composite and isn't created by any action`,
            severity: 'error',
          });
        }
      }
      return errors;
    },
  },

  // Rule 4: Trigger action references must resolve to existing actions
  {
    name: 'trigger-action-references-must-resolve',
    validate(components, assetName) {
      const triggers = getComponentData(components, 'asset-packs::Triggers');
      const actions = getComponentData(components, 'asset-packs::Actions');
      if (!triggers?.value) return [];

      const errors: ValidationError[] = [];

      for (const trigger of triggers.value) {
        for (const actionRef of trigger.actions ?? []) {
          // Only validate self-references (cross-entity refs can't be checked in a single composite)
          const isSelfRef =
            actionRef.id === '{self}' ||
            actionRef.id === '{self:asset-packs::Actions}' ||
            actionRef.id === actions?.id;

          if (isSelfRef && actions?.value) {
            const actionNames = new Set(actions.value.map((a: any) => a.name));
            if (!actionNames.has(actionRef.name)) {
              errors.push({
                rule: 'trigger-action-references-must-resolve',
                message: `"${assetName}" trigger "${trigger.type}" references action "${actionRef.name}" which doesn't exist`,
                severity: 'error',
              });
            }
          }
        }
      }
      return errors;
    },
  },

  // ─── Tier 2: High value ──────────────────────────────────────────────

  // Rule 5: Animator requires GltfContainer
  {
    name: 'animator-requires-gltf',
    validate(components, assetName) {
      if (
        hasComponent(components, 'core::Animator') &&
        !hasComponent(components, 'core::GltfContainer')
      ) {
        return [
          {
            rule: 'animator-requires-gltf',
            message: `"${assetName}" has Animator but no GltfContainer — animations live inside GLTF models`,
            severity: 'error',
          },
        ];
      }
      return [];
    },
  },

  // Rule 6: VideoPlayer requires a display surface
  {
    name: 'video-player-requires-display',
    validate(components, assetName) {
      if (!hasComponent(components, 'core::VideoPlayer')) return [];
      const errors: ValidationError[] = [];

      const hasTexture =
        hasComponent(components, 'core::GltfNodeModifiers') ||
        hasComponent(components, 'core::Material');
      if (!hasTexture) {
        errors.push({
          rule: 'video-player-requires-display',
          message: `"${assetName}" has VideoPlayer but no GltfNodeModifiers or Material for video texture`,
          severity: 'error',
        });
      }

      const hasSurface =
        hasComponent(components, 'core::GltfContainer') ||
        hasComponent(components, 'core::MeshRenderer');
      if (!hasSurface) {
        errors.push({
          rule: 'video-player-requires-display',
          message: `"${assetName}" has VideoPlayer but no render surface (GltfContainer or MeshRenderer)`,
          severity: 'error',
        });
      }
      return errors;
    },
  },

  // Rule 7: States should be referenced in triggers or actions
  {
    name: 'states-must-be-referenced',
    validate(components, assetName) {
      const states = getComponentData(components, 'asset-packs::States');
      if (!states?.value || states.value.length === 0) return [];

      const triggers = getComponentData(components, 'asset-packs::Triggers');
      const actions = getComponentData(components, 'asset-packs::Actions');

      const compositJson = JSON.stringify({ triggers, actions });

      const hasStateReference =
        compositJson.includes('set_state') ||
        compositJson.includes('when_state_is') ||
        compositJson.includes('when_state_is_not') ||
        compositJson.includes('when_previous_state_is') ||
        compositJson.includes('on_state_change');

      if (!hasStateReference) {
        return [
          {
            rule: 'states-must-be-referenced',
            message: `"${assetName}" defines States but they are never referenced in triggers or actions`,
            severity: 'warning',
          },
        ];
      }
      return [];
    },
  },

  // Rule 8: Tween requires Transform
  {
    name: 'tween-requires-transform',
    validate(components, assetName) {
      const hasTween =
        hasComponent(components, 'core::Tween') || hasComponent(components, 'core::TweenSequence');
      if (hasTween && !hasComponent(components, 'core::Transform')) {
        return [
          {
            rule: 'tween-requires-transform',
            message: `"${assetName}" has Tween but no Transform`,
            severity: 'warning',
          },
        ];
      }
      return [];
    },
  },

  // Rule 9: LightSource requires Transform
  {
    name: 'light-source-requires-transform',
    validate(components, assetName) {
      if (
        hasComponent(components, 'core::LightSource') &&
        !hasComponent(components, 'core::Transform')
      ) {
        return [
          {
            rule: 'light-source-requires-transform',
            message: `"${assetName}" has LightSource but no Transform`,
            severity: 'warning',
          },
        ];
      }
      return [];
    },
  },

  // ─── Tier 3: Nice to have ────────────────────────────────────────────

  // Rule 10: Asset file references should use valid paths
  // (filesystem check — handled separately in validate.ts since it needs file access)

  // Rule 11: Action names must be unique within an Actions component
  {
    name: 'actions-unique-names',
    validate(components, assetName) {
      const actions = getComponentData(components, 'asset-packs::Actions');
      if (!actions?.value) return [];

      const names = actions.value.map((a: any) => a.name);
      const seen = new Set<string>();
      const duplicates = new Set<string>();

      for (const name of names) {
        if (seen.has(name)) duplicates.add(name);
        seen.add(name);
      }

      if (duplicates.size > 0) {
        return [
          {
            rule: 'actions-unique-names',
            message: `"${assetName}" has duplicate action names: ${[...duplicates].join(', ')}`,
            severity: 'warning',
          },
        ];
      }
      return [];
    },
  },

  // Rule 12: Trigger conditions must reference valid components
  {
    name: 'trigger-conditions-reference-valid-components',
    validate(components, assetName) {
      const triggers = getComponentData(components, 'asset-packs::Triggers');
      if (!triggers?.value) return [];

      const errors: ValidationError[] = [];

      for (const trigger of triggers.value) {
        for (const condition of trigger.conditions ?? []) {
          const type: string = condition.type ?? '';

          if (type.startsWith('when_state_is') || type.startsWith('when_previous_state_is')) {
            const isSelfRef =
              condition.id === '{self}' || condition.id === '{self:asset-packs::States}';
            if (isSelfRef && !hasComponent(components, 'asset-packs::States')) {
              errors.push({
                rule: 'trigger-conditions-reference-valid-components',
                message: `"${assetName}" trigger "${trigger.type}" has state condition but no States component`,
                severity: 'error',
              });
            }
          }

          if (type.startsWith('when_counter_')) {
            const isSelfRef =
              condition.id === '{self}' || condition.id === '{self:asset-packs::Counter}';
            if (isSelfRef && !hasComponent(components, 'asset-packs::Counter')) {
              errors.push({
                rule: 'trigger-conditions-reference-valid-components',
                message: `"${assetName}" trigger "${trigger.type}" has counter condition but no Counter component`,
                severity: 'error',
              });
            }
          }
        }
      }
      return errors;
    },
  },

  // Rule 13: TextShape is mutually exclusive with MeshRenderer and GltfContainer
  {
    name: 'text-shape-mutually-exclusive',
    validate(components, assetName) {
      if (!hasComponent(components, 'core::TextShape')) return [];

      const conflicts: string[] = [];
      if (hasComponent(components, 'core::MeshRenderer')) conflicts.push('MeshRenderer');
      if (hasComponent(components, 'core::GltfContainer')) conflicts.push('GltfContainer');

      if (conflicts.length > 0) {
        return [
          {
            rule: 'text-shape-mutually-exclusive',
            message: `"${assetName}" has TextShape with ${conflicts.join(' and ')} — they are mutually exclusive`,
            severity: 'warning',
          },
        ];
      }
      return [];
    },
  },
];
