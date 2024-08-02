import path from 'node:path';
import fs from 'node:fs/promises';

type StorageData = {
  [key: string]: unknown;
};

interface IStorage {
  get<T>(key: string): Promise<T>;
  has(key: string): Promise<boolean>;
  set<T>(key: string, value: T): Promise<void>;
}

export class FileSystemStorage implements IStorage {
  private inited = false;

  constructor(public storagePath: string) {}

  private async init() {
    if (this.inited) {
      return;
    }
    const dir = path.dirname(this.storagePath);
    try {
      await fs.stat(dir);
    } catch (error) {
      await fs.mkdir(dir, { recursive: true });
    }

    try {
      await fs.stat(this.storagePath);
    } catch (error) {
      await fs.writeFile(this.storagePath, '{}', 'utf-8');
    }
  }

  async get<T>(key: string) {
    if (!this.inited) {
      await this.init();
    }
    const data = await this.read();
    return data[key] as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.inited) {
      await this.init();
    }
    const data = await this.read();
    data[key] = value;
    await this.write(data);
  }

  async has(key: string) {
    if (!this.inited) {
      await this.init();
    }
    const data = await this.read();
    return key in data;
  }

  private async read(): Promise<StorageData> {
    if (!this.inited) {
      await this.init();
    }
    try {
      const content = await fs.readFile(this.storagePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading config file:', error);
      return {};
    }
  }

  private async write(data: StorageData) {
    if (!this.inited) {
      await this.init();
    }
    try {
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing config file:', error);
    }
  }
}
