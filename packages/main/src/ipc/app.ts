import { app, ipcMain } from 'electron';

export default () => {
  ipcMain.handle('app.getPath', async (_event, name) => app.getPath(name));
};
