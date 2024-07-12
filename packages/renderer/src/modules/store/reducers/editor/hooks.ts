import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../workspace/hooks';

export const useEditor = () => {
  const [search] = useSearchParams();
  const path = useMemo(() => search.get('path'), [search]);
  const workspace = useWorkspace();
  const project = useMemo(() => {
    return workspace.projects.find(project => project.path === path);
  }, [workspace.projects, path]);
  return { project };
};
