import path from 'node:path';
import { FileSystemStorage } from '/shared/types/storage';
import { SETTINGS_DIRECTORY } from '/shared/paths';
import { getUserDataPath } from './electron';

export const CONFIG_PATH = path.join(getUserDataPath(), SETTINGS_DIRECTORY, 'config.json');
export const config = await FileSystemStorage.getOrCreate(CONFIG_PATH);
