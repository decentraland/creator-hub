import { createAsyncThunk } from '@reduxjs/toolkit';

/*
  nth: the plugin "unplugin-auto-expose" we use for auto-exporting stuff to the preload package
  is removing the function names when exporting them. Maybe we can find a way to avoid that so we
  don't need to provide a name for the thunk and just use the function.name
*/
export function initThunkCreator(namespace: string) {
  return <K, P = void>(name: string, fn: (arg: P) => Promise<K>) =>
    createAsyncThunk(
      `${namespace}/${name}`,
      async (arg: P): Promise<Awaited<ReturnType<typeof fn>>> => {
        const result = await fn(arg);
        return result;
      },
    );
}
