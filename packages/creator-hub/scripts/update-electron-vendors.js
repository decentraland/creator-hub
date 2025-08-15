/**
 * This script should be run in electron context
 * @example
 *  ELECTRON_RUN_AS_NODE=1 electron scripts/update-electron-vendors.js
 *  ELECTRON_RUN_AS_NODE=1 electron packages/creator-hub/scripts/update-electron-vendors.js
 */

import { writeFileSync } from 'fs';
import path from 'path';

const electronRelease = process.versions;

const node = electronRelease.node.split('.')[0];
const chrome = electronRelease.v8.split('.').splice(0, 2).join('');

// Determine the creator-hub directory
function getCreatorHubDir() {
  const currentDir = process.cwd();

  // If we're in the root directory (has packages/creator-hub)
  if (
    path.basename(currentDir) !== 'creator-hub' &&
    path.basename(path.dirname(currentDir)) !== 'creator-hub'
  ) {
    return path.join(currentDir, 'packages', 'creator-hub');
  }

  // If we're already in the creator-hub directory
  return currentDir;
}

const creatorHubDir = getCreatorHubDir();
const browserslistrcPath = path.join(creatorHubDir, '.browserslistrc');
const electronVendorsPath = path.join(creatorHubDir, '.electron-vendors.cache.json');

writeFileSync(electronVendorsPath, JSON.stringify({ chrome, node }));
writeFileSync(browserslistrcPath, `Chrome ${chrome}`, 'utf8');
