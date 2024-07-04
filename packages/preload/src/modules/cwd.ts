import fs from 'node:fs/promises';
import {ipc} from './ipc';

export async function getCwd() {
  const home = await ipc.path.getHome();
  const cwd = `${home}/.decentraland`;
  try {
    await fs.stat(cwd);
  } catch (error) {
    console.log('creating dir!');
    await fs.mkdir(cwd);
  }
  console.log('cwd:', cwd);
  return cwd;
}
