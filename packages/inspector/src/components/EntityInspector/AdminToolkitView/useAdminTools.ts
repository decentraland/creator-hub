import { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import type { EditorComponents, EditorComponentsTypes } from '../../../lib/sdk/components';

type AdminToolsValue = EditorComponentsTypes['AdminTools'];

export type AdminControlKey =
  | 'videoControl'
  | 'textAnnouncementControl'
  | 'rewardsControl'
  | 'smartItemsControl';

/** Reads the AdminTools component of `entity` and patches one control at a time. */
export function useAdminTools(entity: Entity, AdminTools: EditorComponents['AdminTools']) {
  const [adminTools, setAdminTools] = useComponentValue(entity, AdminTools);

  const updateControl = useCallback(
    <K extends AdminControlKey>(key: K, patch: Partial<AdminToolsValue[K]>) =>
      setAdminTools(prev => ({ ...prev, [key]: { ...prev[key], ...patch } })),
    [setAdminTools],
  );

  return [adminTools, updateControl] as const;
}
