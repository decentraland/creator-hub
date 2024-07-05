import { useEffect } from 'react';
import { useDispatch, useSelector } from '#store';
import { getWorkspace } from '/@/modules/store/reducers/workspace/thunks';

import { ScenesPage } from '/@/components/ScenesPage';
import { SortBy } from '/@/components/ScenesPage/types';

const noop = () => undefined;

export function App() {
  const dispatch = useDispatch();
  const workspace = useSelector(state => state.workspace);

  useEffect(() => {
    dispatch(getWorkspace());
  }, []);

  return (
    <div className="CardList">
      <ScenesPage
        projects={workspace.projects}
        sortBy={SortBy.NEWEST}
        onOpenModal={noop}
        onSort={noop}
      />
    </div>
  );
}
