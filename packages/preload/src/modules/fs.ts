import fs from 'fs/promises';

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (error) {
    return false;
  }
}
