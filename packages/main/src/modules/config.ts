import path from 'node:path';
import { getAppHome } from './electron';
import { FileSystemStorage } from '../../../shared/types/storage';

export const CONFIG_PATH = path.join(getAppHome(), 'config.json');
export const config = new FileSystemStorage('config.json');
