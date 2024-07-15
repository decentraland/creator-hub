import { useSelector } from '#store';

export const useWorkspace = () => {
  const workspace = useSelector(state => state.workspace);
  return workspace;
};
