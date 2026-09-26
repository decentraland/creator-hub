import type { AssetComposite } from '../types';
import {
  getComponent,
  getComponentData,
  hasComponent,
  hasPointerCollider,
  hasAnyCollisionMask,
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

  // Rule 3: Trigger action references must resolve to existing actions
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

  // Rule 13: TextShape is mutually exclusive with MeshRenderer and GltfContainer on the SAME entity
  {
    name: 'text-shape-mutually-exclusive',
    validate(components, assetName) {
      const textShape = getComponent(components, 'core::TextShape');
      if (!textShape) return [];

      const textEntityKeys = new Set(Object.keys(textShape.data));
      const errors: ValidationError[] = [];

      const meshRenderer = getComponent(components, 'core::MeshRenderer');
      const gltfContainer = getComponent(components, 'core::GltfContainer');

      for (const entityKey of textEntityKeys) {
        const conflicts: string[] = [];
        if (meshRenderer?.data[entityKey]) conflicts.push('MeshRenderer');
        if (gltfContainer?.data[entityKey]) conflicts.push('GltfContainer');

        if (conflicts.length > 0) {
          errors.push({
            rule: 'text-shape-mutually-exclusive',
            message: `"${assetName}" entity ${entityKey} has TextShape with ${conflicts.join(' and ')} — they are mutually exclusive`,
            severity: 'warning',
          });
        }
      }
      return errors;
    },
  },
];
