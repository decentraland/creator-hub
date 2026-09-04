// draco3dgltf ships no type declarations. We only need the two factory functions, and the
// consuming code treats the result as opaque (passed straight to gltf-transform as an IO
// dependency), so a minimal ambient declaration is enough.
declare module 'draco3dgltf' {
  export function createEncoderModule(options?: unknown): Promise<unknown>;
  export function createDecoderModule(options?: unknown): Promise<unknown>;
  const draco3d: {
    createEncoderModule: typeof createEncoderModule;
    createDecoderModule: typeof createDecoderModule;
  };
  export default draco3d;
}
