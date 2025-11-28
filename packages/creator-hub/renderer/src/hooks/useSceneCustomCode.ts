import { useState, useCallback } from 'react';
import { workspace } from '#preload';
import { hasCustomCode } from '/shared/scene-parser';
import type { Project } from '/shared/types/projects';

export function useSceneCustomCode(
  project: Project | undefined,
  filePath: string = 'src/index.ts',
) {
  const [state, setState] = useState<{
    isCustomCode: boolean;
    isLoading: boolean;
    error: Error | null;
  }>({
    isCustomCode: false,
    isLoading: false,
    error: null,
  });

  const detectCustomCode = useCallback(async (): Promise<boolean> => {
    if (!project) return false;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const content = await workspace.getSceneSourceFile(project.path, filePath);
      const hasCustom = hasCustomCode(content);
      setState({ isCustomCode: hasCustom, isLoading: false, error: null });
      return hasCustom;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setState(prev => ({ ...prev, isLoading: false, error }));
      return false;
    }
  }, [project?.path, filePath]);

  return { ...state, detectCustomCode };
}
