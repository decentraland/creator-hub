/*
  Adds missing "author": "Decentraland Foundation" to paths like:
  packs/(pack)/assets/(item)/data.json
  - Preserves indentation (tabs vs spaces and width) when possible
  - Appends the author field as the last property to preserve key order
*/

const fs = require('fs');
const path = require('path');

const ROOT = '/Users/Nico/Documents/github/asset-packs/packs';

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (_) {
    return false;
  }
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function detectIndent(jsonText) {
  const lines = jsonText.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\s+)\S/);
    if (m && m[1]) {
      const ws = m[1];
      if (ws.includes('\t')) return '\t';
      const spaceCount = Math.min(ws.length, 10);
      return ' '.repeat(spaceCount === 0 ? 2 : spaceCount);
    }
  }
  return '  ';
}

function addAuthorIfMissing(dataPath) {
  const original = fs.readFileSync(dataPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(original);
  } catch (err) {
    console.error(`Skipping invalid JSON: ${dataPath}`);
    return { updated: false, reason: 'invalid-json' };
  }

  if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'author')) {
    return { updated: false, reason: 'already-has-author' };
  }

  // Preserve key order by recreating with existing keys then appending author
  const updatedObj = {};
  for (const key of Object.keys(parsed)) {
    updatedObj[key] = parsed[key];
  }
  updatedObj.author = 'Decentraland Foundation';

  const indent = detectIndent(original);
  const endsWithNewline = original.endsWith('\n');
  const updatedText = JSON.stringify(updatedObj, null, indent) + (endsWithNewline ? '\n' : '');

  if (updatedText === original) {
    return { updated: false, reason: 'no-change' };
  }

  fs.writeFileSync(dataPath, updatedText, 'utf8');
  return { updated: true };
}

function main() {
  const summaryOnly = process.argv.includes('--summary-only');
  if (!isDirectory(ROOT)) {
    console.error(`Root not found: ${ROOT}`);
    process.exit(1);
  }

  let scanned = 0;
  let updated = 0;
  const updatedFiles = [];

  const packs = fs
    .readdirSync(ROOT)
    .map(p => path.join(ROOT, p))
    .filter(isDirectory);
  for (const packDir of packs) {
    const assetsDir = path.join(packDir, 'assets');
    if (!isDirectory(assetsDir)) continue;

    const items = fs
      .readdirSync(assetsDir)
      .map(p => path.join(assetsDir, p))
      .filter(isDirectory);
    for (const itemDir of items) {
      const dataPath = path.join(itemDir, 'data.json');
      if (!fileExists(dataPath)) continue;

      scanned += 1;
      const res = addAuthorIfMissing(dataPath);
      if (res.updated) {
        updated += 1;
        updatedFiles.push(dataPath);
      }
    }
  }

  console.log(`Scanned data.json files: ${scanned}`);
  console.log(`Updated files: ${updated}`);
  if (!summaryOnly && updatedFiles.length > 0) {
    console.log('Files updated:');
    for (const f of updatedFiles) console.log(f);
  }
}

main();
