import type { UIRequest } from './iframe';

// storage interface
export interface Storage {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, content: Buffer): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  list(path: string): Promise<{ name: string; isDirectory: boolean }[]>;
  requestUI(request: UIRequest): Promise<void>;
}
