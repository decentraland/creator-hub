import { createAsyncThunk } from '@reduxjs/toolkit';

export function initThunkCreator(namespace: string) {
  return <K, P = void>(fn: (arg: P) => Promise<K>) =>
    createAsyncThunk(
      `${namespace}/${fn.name}`,
      async (arg: P): Promise<Awaited<ReturnType<typeof fn>>> => {
        const result = await fn(arg);
        return result;
      },
    );
}
