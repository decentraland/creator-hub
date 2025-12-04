/*
  Resolves merge conflicts in JSON files under paths like:
  packs/(pack)/assets/(item)/data.json
  - Removes Git conflict markers by selecting one side to form valid JSON
  - Ensures both "id" and "author" fields are present if either side added them
  - Preserves indentation (tabs vs spaces and width) and trailing newline
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

function hasConflictMarkers(text) {
  return text.includes('<<<<<<<') && text.includes('=======') && text.includes('>>>>>>>');
}

function extractFieldValue(block, field) {
  const re = new RegExp('\\"' + field + '\\"\\s*:\\s*\\"([^\\"]*)\\"');
  const m = block.match(re);
  return m ? m[1] : undefined;
}

function resolveConflictsKeep(text, prefer = 'left') {
  let idx = 0;
  let output = '';
  const meta = { idsLeft: [], idsRight: [], authorsLeft: [], authorsRight: [] };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const start = text.indexOf('<<<<<<<', idx);
    if (start === -1) {
      output += text.slice(idx);
      break;
    }
    const startLineEnd = text.indexOf('\n', start);
    const mid = text.indexOf('=======', startLineEnd === -1 ? start : startLineEnd + 1);
    const midLineEnd = text.indexOf('\n', mid);
    const end = text.indexOf('>>>>>>>', midLineEnd === -1 ? mid : midLineEnd + 1);
    const endLineEnd = text.indexOf('\n', end);

    if (mid === -1 || end === -1) {
      // malformed conflict; bail by removing markers crudely
      output += text.slice(idx).replace(/<<<<<<<[\s\S]*?>>>>>>>.*?(\n|$)/g, '');
      break;
    }

    const leftStart = startLineEnd === -1 ? start : startLineEnd + 1;
    const leftEnd = mid;
    const rightStart = midLineEnd === -1 ? mid : midLineEnd + 1;
    const rightEnd = end;

    const left = text.slice(leftStart, leftEnd);
    const right = text.slice(rightStart, rightEnd);

    const idL = extractFieldValue(left, 'id');
    const idR = extractFieldValue(right, 'id');
    if (idL) meta.idsLeft.push(idL);
    if (idR) meta.idsRight.push(idR);

    const authorL = extractFieldValue(left, 'author');
    const authorR = extractFieldValue(right, 'author');
    if (authorL) meta.authorsLeft.push(authorL);
    if (authorR) meta.authorsRight.push(authorR);

    output += text.slice(idx, start);
    output += prefer === 'left' ? left : right;

    idx = endLineEnd === -1 ? text.length : endLineEnd + 1;
  }

  return { text: output, meta };
}

function tryParseJSON(text) {
  try {
    return { ok: true, obj: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function ensureFields(obj, meta) {
  const hadIdInConflict = meta.idsLeft.length > 0 || meta.idsRight.length > 0;
  const idFromLeft = meta.idsLeft[0];
  const idFromRight = meta.idsRight[0];
  if (hadIdInConflict && !Object.prototype.hasOwnProperty.call(obj, 'id')) {
    obj.id = idFromLeft || idFromRight;
  }

  const hadAuthorInConflict = meta.authorsLeft.length > 0 || meta.authorsRight.length > 0;
  if (hadAuthorInConflict && !Object.prototype.hasOwnProperty.call(obj, 'author')) {
    obj.author = 'Decentraland Foundation';
  }
}

function processFile(dataPath) {
  const original = fs.readFileSync(dataPath, 'utf8');
  if (!hasConflictMarkers(original)) return { changed: false, reason: 'no-conflict' };

  const indent = detectIndent(original);
  const endsWithNewline = original.endsWith('\n');

  let { text: leftResolved, meta } = resolveConflictsKeep(original, 'left');
  let parsed = tryParseJSON(leftResolved);
  if (!parsed.ok) {
    const rightAttempt = resolveConflictsKeep(original, 'right');
    leftResolved = rightAttempt.text;
    meta = rightAttempt.meta;
    parsed = tryParseJSON(leftResolved);
  }
  if (!parsed.ok) {
    console.error(`Failed to parse after conflict removal: ${dataPath}`);
    return { changed: false, reason: 'parse-failed' };
  }

  const obj = parsed.obj;
  const beforeString = JSON.stringify(obj);
  ensureFields(obj, meta);
  const afterString = JSON.stringify(obj);
  const changedFields = beforeString !== afterString;

  const updatedText = JSON.stringify(obj, null, indent) + (endsWithNewline ? '\n' : '');
  if (updatedText === original) return { changed: false, reason: 'no-change' };

  fs.writeFileSync(dataPath, updatedText, 'utf8');
  return { changed: true, changedFields };
}

function main() {
  const summaryOnly = process.argv.includes('--summary-only');

  if (!isDirectory(ROOT)) {
    console.error(`Root not found: ${ROOT}`);
    process.exit(1);
  }

  let scanned = 0;
  let resolved = 0;
  const resolvedFiles = [];

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
      const text = fs.readFileSync(dataPath, 'utf8');
      if (!hasConflictMarkers(text)) continue;

      scanned += 1;
      const res = processFile(dataPath);
      if (res.changed) {
        resolved += 1;
        resolvedFiles.push(dataPath);
      }
    }
  }

  console.log(`Files with conflicts scanned: ${scanned}`);
  console.log(`Files resolved: ${resolved}`);
  if (!summaryOnly && resolvedFiles.length > 0) {
    console.log('Resolved:');
    for (const f of resolvedFiles) console.log(f);
  }
}

main();
