import { useMemo } from 'react';

import { useEntitiesWith } from './useEntitiesWith';
import { useSdk } from './useSdk';

export type VideoPlayerOption = { value: string; label: string };

/**
 * Every VideoPlayer entity in the scene as `{ value, label }` dropdown
 * options, labeled by the entity's Name (falling back to `Entity <id>` so
 * unnamed players stay selectable). Shared by the UI Designer's TextureField
 * and the MaterialInspector's Texture section.
 */
export const useVideoPlayerOptions = (): VideoPlayerOption[] => {
  const sdk = useSdk();
  const entitiesWithVideoPlayer = useEntitiesWith(components => components.VideoPlayer);

  return useMemo(() => {
    const Name = sdk?.components.Name;
    return entitiesWithVideoPlayer.map(entity => ({
      value: String(entity),
      label: (Name?.getOrNull(entity)?.value ?? `Entity ${entity}`) as string,
    }));
  }, [sdk, entitiesWithVideoPlayer]);
};
