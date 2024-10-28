import { actions as workspaceActions } from '../workspace';
import { actions as editorActions } from '../editor';
import { trackAction } from './utils';

trackAction(workspaceActions.createProject.fulfilled, 'Create Project', async action => ({
  project_id: action.payload.id,
  project_name: action.payload.title,
  template: action.payload.description,
  rows: action.payload.layout.rows,
  cols: action.payload.layout.cols,
}));

trackAction(workspaceActions.runProject.fulfilled, 'Open Project', async action => ({
  project_id: action.payload.id,
  project_name: action.payload.title,
}));

trackAction(workspaceActions.updateProject, 'Save Project Success', async action => ({
  project_id: action.payload.id,
  project_name: action.payload.title,
}));

trackAction(editorActions.runScene.pending, 'Preview Scene', async (_action, getState) => ({
  project_id: getState().editor.project?.id,
}));
trackAction(editorActions.publishScene.fulfilled, 'Publish Scene', async (action, getState) => ({
  project_id: getState().editor.project?.id,
  target: action.meta.arg.target,
  targetContent: action.meta.arg.targetContent,
}));
