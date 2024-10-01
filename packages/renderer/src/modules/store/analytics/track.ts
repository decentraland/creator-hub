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

trackAction(editorActions.setProject, 'Open Project', async action => ({
  project_id: action.payload.id,
  project_name: action.payload.title,
}));

// The saveThumbnail action is dispatched every time the user makes a change to the project so we can use it as a proxy to track the Save Project Success event.
trackAction(workspaceActions.saveThumbnail.fulfilled, 'Save Project Success', async action => ({
  project_id: action.payload.id,
  project_name: action.payload.title,
}));

trackAction(editorActions.runScene.pending, 'Preview Scene', async (_action, getState) => ({
  project_id: getState().editor.project?.id,
}));
trackAction(editorActions.publishScene.fulfilled, 'Publish Scene', async (_action, getState) => ({
  project_id: getState().editor.project?.id,
}));
