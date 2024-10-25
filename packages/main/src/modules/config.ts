import path from 'node:path';
import { app } from 'electron';

import { FileSystemStorage } from '../../../shared/types/storage';

export const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
export const config = await FileSystemStorage.create(CONFIG_PATH);
