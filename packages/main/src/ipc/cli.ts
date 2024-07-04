import {ipcMain} from 'electron';

async function preview() {
  // TODO
  console.log('launch preview');
}

export default () => {
  ipcMain.handle('cli.preview', preview);
};
