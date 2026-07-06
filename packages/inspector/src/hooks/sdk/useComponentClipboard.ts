import { useCallback } from 'react';
import type { Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';

import type { Component } from '../../lib/sdk/components';
import { useSnackbar } from '../useSnackbar';
import { useSdk } from './useSdk';
import { getComponentValue, isLastWriteWinComponent } from './useComponentValue';

const CLIPBOARD_TAG = '__dclComponent';
const TRANSFORM_COMPONENT_NAME = 'core::Transform';
const UI_TRANSFORM_COMPONENT_NAME = 'core::UiTransform';

type ClipboardPayload = {
  [CLIPBOARD_TAG]: string;
  value: unknown;
};

let memoryClipboard: string | null = null;

const writeClipboard = async (text: string): Promise<void> => {
  memoryClipboard = text;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to legacy fallback
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch {
    // memoryClipboard already set; inspector→inspector paste still works
  }
};

const readClipboard = async (): Promise<string> => {
  try {
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // fall through
  }
  return memoryClipboard ?? '';
};

const toEntities = (target: Entity | Entity[]): Entity[] =>
  Array.isArray(target) ? target : [target];

const getDisplayName = (componentName: string): string => {
  const match = componentName.match(/[^:]*$/);
  return (match && match[0]) || componentName;
};

// Copy/paste of a transform must not carry tree-structure pointers: for
// `core::Transform` that's `parent`; for `core::UiTransform` it's `parent` AND
// `rightOf` (the UI sibling-order link). Pasting either would silently reparent
// / reorder the target — see CLAUDE.md on UiTransform parent/rightOf.
const stripTreePointers = (componentName: string, value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  if (componentName === TRANSFORM_COMPONENT_NAME) {
    const { parent: _p, ...rest } = value as Record<string, unknown>;
    return rest;
  }
  if (componentName === UI_TRANSFORM_COMPONENT_NAME) {
    const { parent: _p, rightOf: _r, ...rest } = value as Record<string, unknown>;
    return rest;
  }
  return value;
};

export const useComponentClipboard = <T>(
  target?: Entity | Entity[] | null,
  component?: Component<T> | null,
) => {
  const sdk = useSdk();
  const { pushNotification } = useSnackbar();

  const enabled = !!target && !!component;

  const onCopyValues = useCallback(async () => {
    if (!component || !target) return;
    const entities = toEntities(target);
    if (entities.length === 0) return;
    try {
      const value = getComponentValue(entities[0], component);
      const normalized = stripTreePointers(component.componentName, value);
      const payload: ClipboardPayload = {
        [CLIPBOARD_TAG]: component.componentName,
        value: normalized,
      };
      await writeClipboard(JSON.stringify(payload, null, 2));
      await pushNotification('success', `${getDisplayName(component.componentName)} values copied`);
    } catch (error) {
      console.error('Failed to copy component values', error);
      await pushNotification('error', 'Failed to copy values');
    }
  }, [target, component, pushNotification]);

  const onPasteValues = useCallback(async () => {
    if (!sdk || !component || !target) return;
    const entities = toEntities(target);
    if (entities.length === 0) return;

    const raw = await readClipboard();

    let parsed: ClipboardPayload | null = null;
    try {
      const candidate = JSON.parse(raw);
      if (
        candidate &&
        typeof candidate === 'object' &&
        typeof candidate[CLIPBOARD_TAG] === 'string'
      ) {
        parsed = candidate as ClipboardPayload;
      }
    } catch {
      // not JSON, fall through to mismatch error
    }

    const targetName = getDisplayName(component.componentName);

    if (!parsed) {
      await pushNotification('error', `Clipboard does not contain ${targetName} values`);
      return;
    }

    if (parsed[CLIPBOARD_TAG] !== component.componentName) {
      const sourceName = getDisplayName(parsed[CLIPBOARD_TAG]);
      await pushNotification('error', `Cannot paste ${sourceName} values into ${targetName}`);
      return;
    }

    if (!isLastWriteWinComponent(component)) {
      await pushNotification('error', `Paste not supported for ${targetName}`);
      return;
    }

    try {
      const value = stripTreePointers(component.componentName, parsed.value) as T;
      const lwwComponent = component as LastWriteWinElementSetComponentDefinition<T>;
      for (const entity of entities) {
        sdk.operations.updateValue(lwwComponent, entity, value as Partial<T>);
      }
      await sdk.operations.dispatch();
      await pushNotification('success', `${targetName} values pasted`);
    } catch (error) {
      console.error('Failed to paste component values', error);
      await pushNotification('error', 'Failed to paste values');
    }
  }, [target, component, sdk, pushNotification]);

  return { onCopyValues, onPasteValues, enabled };
};
