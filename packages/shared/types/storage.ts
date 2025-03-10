import path from 'node:path';
import fs from 'node:fs/promises';

type StorageData = {
  [key: string]: unknown;
};

export type IFileSystemStorage = Awaited<ReturnType<typeof _createFileSystemStorage>>;

async function _createFileSystemStorage(storagePath: string) {
  const dir = path.dirname(storagePath);
  try {
    await fs.stat(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    await fs.stat(storagePath);
  } catch (error) {
    await fs.writeFile(storagePath, '{}', 'utf-8');
  }

  const read = async (): Promise<StorageData> => {
    try {
      const content = await fs.readFile(storagePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading config file:', error);
      return {};
    }
  };

  const write = async (data: StorageData): Promise<void> => {
    try {
      await fs.writeFile(storagePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing config file:', error);
    }
  };

  return {
    get: async <T>(key: string): Promise<T | undefined> => {
      const data = await read();
      return data[key] as T | undefined;
    },
    getAll: async <T extends StorageData>(): Promise<T> => {
      const data = await read();
      return data as T;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      const data = await read();
      data[key] = value;
      await write(data);
    },
    setAll: async <T extends StorageData>(data: T): Promise<void> => {
      await write(data);
    },
    has: async (key: string): Promise<boolean> => {
      const data = await read();
      return key in data;
    },
  };
}

// In-memory Map of storages
const storageMap = new Map<string, IFileSystemStorage>();

export const FileSystemStorage = {
  async create(path: string): Promise<IFileSystemStorage> {
    const storage = await _createFileSystemStorage(path);
    storageMap.set(path, storage);
    return storage;
  },
  get(path: string): IFileSystemStorage | undefined {
    return storageMap.get(path);
  },
  async getOrCreate(path: string): Promise<IFileSystemStorage> {
    return storageMap.get(path) ?? (await this.create(path));
  },
};
