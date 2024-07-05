import { ipcMain } from 'electron';

export default () => {
  ipcMain.handle('cli.preview', () => console.log('launch preview')); // TODO
};
