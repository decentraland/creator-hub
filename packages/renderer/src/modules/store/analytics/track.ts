import { actions as workspaceActions } from '../workspace';
import { hash, trackAction } from './utils';

trackAction(workspaceActions.createProject.fulfilled, 'Create Project', async action => ({
  project_id: await hash(action.payload.path),
  project_name: action.payload.title,
  project_description: action.payload.description,
  template: null,
  rows: action.payload.layout.rows,
  cols: action.payload.layout.cols,
}));
