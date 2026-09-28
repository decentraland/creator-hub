declare module 'cross-spawn' {
  import type { spawn, spawnSync } from 'child_process';
  const crossSpawn: typeof spawn & { sync: typeof spawnSync };
  export default crossSpawn;
}
