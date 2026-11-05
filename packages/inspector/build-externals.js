const child_process = require('child_process');
const { builtinModules } = require('module');

const esmModulesToBundle = [
  '@dcl/sdk',
  '@dcl/ecs',
  '@dcl/mini-rpc',
  '@dcl/asset-packs',
  '@dcl-sdk/utils',
  '@dcl/gltf-validator-ts',
  '@dcl/ecs-math',
  '@babylonjs/core',
];

/** Modules left as runtime `require`s in the Node tooling bundle. */
function getNotBundledModules() {
  const child = child_process.execSync('npm ls --all --json || true', {
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const ret = JSON.parse(child.toString());

  const externalModules = new Set();
  function traverseDependencies(obj) {
    if (obj.dependencies)
      for (let depName in obj.dependencies) {
        const dep = obj.dependencies[depName];
        externalModules.add(depName);
        traverseDependencies(dep);
      }
  }
  traverseDependencies(ret);

  return Array.from(externalModules)
    .concat(builtinModules)
    .filter($ => !esmModulesToBundle.includes($));
}

module.exports = { getNotBundledModules };
