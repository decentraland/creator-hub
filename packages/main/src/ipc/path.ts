import {app, ipcMain} from 'electron';

export function getHome() {
  return app.getPath('home');
}

export default () => {
  ipcMain.handle('path.getHome', getHome);
};
