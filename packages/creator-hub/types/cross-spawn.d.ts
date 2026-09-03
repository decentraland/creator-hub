// cross-spawn ships no bundled types and we deliberately avoid pulling @types/cross-spawn
// (keeps the dependency set lean and sidesteps syncpack). Its default export is a drop-in for
// child_process.spawn, so borrow that signature.
declare module 'cross-spawn' {
  import type { spawn } from 'child_process';
  const crossSpawn: typeof spawn;
  export default crossSpawn;
}
