import { useState, useCallback } from 'react';
import { workspace } from '#preload';
import { hasCustomCode } from '/shared/scene-parser';
import type { Project } from '/shared/types/projects';

interface UseSceneCustomCodeResult {
  isCustomCode: boolean;
  isLoading: boolean;
  error: Error | null;
  detectCustomCode: () => Promise<boolean>;
}

export function useSceneCustomCode(
  project: Project | undefined,
  filePath: string = 'src/index.ts',
): UseSceneCustomCodeResult {
  const [isCustomCode, setIsCustomCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const detectCustomCode = useCallback(async (): Promise<boolean> => {
    if (!project) {
      setIsCustomCode(false);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const content = await workspace.getSceneSourceFile(project.path, filePath);
      const hasCustom = hasCustomCode(content);
      setIsCustomCode(hasCustom);
      return hasCustom;
    } catch (err) {
      console.error('Failed to detect custom code:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsCustomCode(false);
      return false; // Default to false on error (safer)
    } finally {
      setIsLoading(false);
    }
  }, [project?.path, filePath]);

  return { isCustomCode, isLoading, error, detectCustomCode };
}
