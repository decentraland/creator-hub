import type { RedactedText } from '../types/ai-sharing';
import { BIP39_ENGLISH } from './bip39-english';

/**
 * Removes secrets and personal details from text the user agreed to share, before it is
 * written to disk or leaves the machine. Each rule swaps a match for `<kind>` and counts it.
 *
 * The rules are tuned against `tests/redact.spec.ts`, which has two sides: text that must be
 * redacted, and ordinary scene code that must survive untouched. A rule that mangles scene
 * code makes the shared data useless, so changing one means running both sides.
 */

interface Rule {
  kind: string;
  pattern: RegExp;
  /** Return null to keep the match as it is. `before` is the character in front of the match. */
  replace?: (match: string, groups: string[], before: string) => string | null;
}

// File extensions that look like a top-level domain after an `@` (`button@2x.png`).
const FILE_EXTENSION =
  /^(?:png|jpe?g|gif|webp|svg|ktx2?|basis|glb|gltf|bin|fbx|obj|mp3|ogg|wav|mp4|webm|json|ts|tsx|js|jsx|css|html|md|txt|zip)$/i;

// A credential's value: quoted (spaces allowed, one line, bounded) or a bare run of 6+ characters.
const CREDENTIAL_VALUE = String.raw`(?:"[^"\r\n]{6,512}"|'[^'\r\n]{6,512}'|[^\s"',}]{6,})`;

const RULES: Rule[] = [
  {
    kind: 'private_key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  },
  // With or without `0x`: wallets export the raw 64 hex digits. A SHA-256 in hex has the same
  // shape and is redacted too; losing one hash is cheaper than leaking one key.
  { kind: 'private_key', pattern: /\b(?:0x)?[0-9a-fA-F]{64}\b/g },
  { kind: 'private_key', pattern: /"ciphertext"\s*:\s*"[0-9a-fA-F]{32,}"/g },
  {
    kind: 'api_key',
    pattern:
      /\b(?:sk-ant-[\w-]{16,}|sk-(?:proj-)?[\w-]{20,}|AIza[\w-]{30,}|gh[opsu]_\w{20,}|github_pat_\w{20,}|xox[abpr]-[\w-]{10,}|(?:sk|rk)_live_\w{16,}|AKIA[0-9A-Z]{16})/g,
  },
  { kind: 'jwt', pattern: /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g },
  {
    kind: 'credential',
    pattern: /(https?:\/\/)[^\s:/@]+:[^\s@/]+@/g,
    replace: (_m, [scheme]) => `${scheme}<credential>@`,
  },
  {
    kind: 'credential',
    pattern:
      /([?&](?:token|key|api_key|apikey|sig|signature|secret|password|access_token)=)[^&\s#]+/gi,
    replace: (_m, [prefix]) => `${prefix}<credential>`,
  },
  // `.env` style: `DB_PASSWORD=…`. A quoted value is taken whole, spaces included (a
  // passphrase), but never past the end of its line, so an unterminated quote can't swallow
  // the code below it.
  {
    kind: 'credential',
    pattern: new RegExp(
      `\\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD)[A-Z0-9_]*\\s*[=:]\\s*)${CREDENTIAL_VALUE}`,
      'g',
    ),
    replace: (_m, [prefix]) => `${prefix}<credential>`,
  },
  // JSON, YAML and camelCase: `"password": "…"`, `apiKey = '…'`. Exact key names only, any
  // case, so `key: "Enter"` or `const secretDoor = "hidden"` stay as they are.
  {
    kind: 'credential',
    pattern: new RegExp(
      `(["']?)\\b((?:db_|client_)?(?:password|passwd|pwd|secret|api_?key|access_?token|auth_?token|private_?key|client_?secret))\\1(\\s*[:=]\\s*)${CREDENTIAL_VALUE}`,
      'gi',
    ),
    // The `.env` rule above may have taken this value already.
    replace: (match, [quote, key, separator]) =>
      match.endsWith('<credential>') ? null : `${quote}${key}${quote}${separator}<credential>`,
  },
  {
    kind: 'credential',
    pattern: /(Bearer\s+)[\w.~+/=-]{8,}/gi,
    replace: (_m, [prefix]) => `${prefix}<credential>`,
  },
  {
    kind: 'email',
    // Every part bounded (RFC 5321 limits): an unbounded local part re-scans a long run of
    // `a.a.a…` from every position, quadratic on a big reply.
    pattern: /(?<![\w.+-])[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){0,8}\.([a-zA-Z]{2,24})\b/g,
    replace: (_m, [tld]) => (FILE_EXTENSION.test(tld) ? null : '<email>'),
  },
  { kind: 'phone', pattern: /(?<![\w.-])\+\d{1,3}(?:[\s.-]\(?\d{2,4}\)?){2,4}(?![\w.-])/g },
  {
    kind: 'phone',
    // Dashes only: with dots, decimals such as `10.123.4567` read as phone numbers.
    pattern: /(?<![\w.-])(?:\(\d{2,4}\)\s?|\d{2,4}[\s-])\d{3,4}-\d{3,4}(?![\w.-])/g,
  },
  {
    kind: 'ip',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b(?!\.\d)/g,
    // A version (`v7.10.2.1`, `pkg@7.10.2.1`) has the same shape; keep it, and keep localhost.
    replace: (m, _groups, before) =>
      m === '127.0.0.1' || m === '0.0.0.0' || /[vV@]/.test(before) ? null : '<ip>',
  },
  {
    kind: 'home_path',
    // Windows separators may arrive escaped (`C:\\Users\\jane` inside JSON), and Windows paths
    // ignore case (`c:\users\jane`). The POSIX branches stay case-sensitive, so URL paths that
    // happen to contain `/users/` are left alone.
    pattern: /(\/Users\/|\/home\/|[A-Za-z]:\\{1,2}[Uu][Ss][Ee][Rr][Ss]\\{1,2})([^/\\\s'"`]+)/g,
    replace: (_m, [root]) => `${root}<user>`,
  },
];

const MIN_SEED_WORDS = 12;

// What may sit between two words of a written-down phrase: any short run without letters, so
// spaces, commas, quotes and brackets (a JSON array), list markers (`1.`, `1)`, `1 `, `- `, `* `)
// and separators (` | `, `-`) all join a run.
const SEED_GAP = /^[^A-Za-z]{1,8}$/;

/** Replaces any run of 12+ BIP-39 words, the shape of a wallet recovery phrase, however listed. */
function redactSeedPhrases(text: string, counts: Record<string, number>): string {
  // JSON-escaped line breaks (`\nabandon`) would glue their letter to the next word. Blanked to
  // the same length, so every offset found in `scan` is the same in `text`.
  const scan = text.replace(/\\[ntr]/g, '  ');
  const words = Array.from(scan.matchAll(/[A-Za-z]+/g), m => ({
    word: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
  const spans: { start: number; end: number }[] = [];
  let runStart = -1;
  const closeRun = (last: number) => {
    if (runStart >= 0 && last - runStart + 1 >= MIN_SEED_WORDS) {
      spans.push({ start: words[runStart].start, end: words[last].end });
    }
    runStart = -1;
  };
  for (let i = 0; i < words.length; i++) {
    const isSeed = BIP39_ENGLISH.has(words[i].word.toLowerCase());
    const joined =
      runStart >= 0 && i > 0 && SEED_GAP.test(scan.slice(words[i - 1].end, words[i].start));
    if (!isSeed) {
      closeRun(i - 1);
      continue;
    }
    if (runStart < 0) runStart = i;
    else if (!joined) {
      closeRun(i - 1);
      runStart = i;
    }
  }
  closeRun(words.length - 1);
  if (spans.length === 0) return text;
  counts.seed_phrase = (counts.seed_phrase ?? 0) + spans.length;
  let out = '';
  let cursor = 0;
  for (const span of spans) {
    out += text.slice(cursor, span.start) + '<seed_phrase>';
    cursor = span.end;
  }
  return out + text.slice(cursor);
}

// `+` and `/` included, as in base64 secrets (`wJalr…/K7MDENG/bPxR…`); no `.`, so file names split.
const HIGH_ENTROPY_CANDIDATE = /[A-Za-z0-9_+/=-]{32,}/g;
// A path's segments are made of words (`assets/scene/DocksModuleStairs_01`); a secret's split
// into one- and two-letter fragments (`wJalrXUtnFEMI` → w, Jalr, XUtn…, `K7MDENG` → K, 7, MDENG).
function isWordySegment(segment: string): boolean {
  if (segment === '' || SAFE_LONG_TOKEN.some(re => re.test(segment))) return true;
  const chunks = segment.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+|[_-]+/g) ?? [];
  if (chunks.join('') !== segment) return false;
  return chunks.every(chunk => /^(?:\d+|[_-]+)$/.test(chunk) || chunk.length >= 3);
}
const SAFE_LONG_TOKEN = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^(?:bafy|bafk)[a-z2-7]{40,}$/,
  /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/,
  /^0x[0-9a-fA-F]{40}$/,
  /^[0-9a-f]{40}$/,
  /^[A-Za-z]+(?:[A-Z][a-z]+)+$/,
  /^[a-z]+(?:[_-][a-z]+)+$/i,
];

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** A long run of random-looking characters that no known-safe shape explains. */
function looksLikeSecret(token: string): boolean {
  if (SAFE_LONG_TOKEN.some(re => re.test(token))) return false;
  if (token.includes('/') && token.split('/').every(isWordySegment)) {
    return false;
  }
  const hasDigit = /\d/.test(token);
  const hasLetter = /[A-Za-z]/.test(token);
  return hasDigit && hasLetter && shannonEntropy(token) >= 4.2;
}

export function redactText(text: string): { text: string; redactions: Record<string, number> } {
  const counts: Record<string, number> = {};
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (match: string, ...rest: unknown[]) => {
      // replace() passes the groups, then the offset, then the whole input.
      const offset = rest.find((value): value is number => typeof value === 'number') ?? 0;
      const groups = rest.slice(0, rest.indexOf(offset)) as string[];
      const before = offset > 0 ? out.charAt(offset - 1) : '';
      const replacement = rule.replace ? rule.replace(match, groups, before) : `<${rule.kind}>`;
      if (replacement === null) return match;
      counts[rule.kind] = (counts[rule.kind] ?? 0) + 1;
      return replacement;
    });
  }
  out = redactSeedPhrases(out, counts);
  out = out.replace(HIGH_ENTROPY_CANDIDATE, token => {
    if (!looksLikeSecret(token)) return token;
    counts.secret = (counts.secret ?? 0) + 1;
    return '<secret>';
  });
  return { text: out, redactions: counts };
}

const cutMarker = (cut: number) => `[… ${cut} chars cut …]`;

/**
 * Keeps the head and tail of text over `max` characters (code points, never splitting a
 * surrogate pair), with a marker saying how much was cut. The result, marker included, is at
 * most `max` characters: the service rejects a field over its limit.
 */
export function truncateMiddle(text: string, max: number): { text: string; truncated: boolean } {
  const chars = Array.from(text);
  if (chars.length <= max) return { text, truncated: false };
  // The marker's length depends on the number it carries, which depends on the marker's length;
  // two passes settle it, since dropping a digit can only shorten the marker.
  let markerLength = cutMarker(chars.length).length;
  let kept = max - markerLength;
  markerLength = cutMarker(chars.length - Math.max(kept, 0)).length;
  kept = max - markerLength;
  if (kept <= 0) return { text: chars.slice(0, max).join(''), truncated: true };
  const head = Math.ceil(kept * 0.75);
  const tail = kept - head;
  const cut = chars.length - kept;
  return {
    text: `${chars.slice(0, head).join('')}${cutMarker(cut)}${tail > 0 ? chars.slice(-tail).join('') : ''}`,
    truncated: true,
  };
}

/**
 * Redacts once and returns a function that truncates the result to any length, for a caller
 * that tries several lengths (shrinking a record to its byte cap) without redacting again.
 */
export function prepareForSharing(text: string): (max: number) => RedactedText {
  const redacted = redactText(text);
  const originalLength = Array.from(text).length;
  return max => {
    const { text: clipped, truncated } = truncateMiddle(redacted.text, max);
    return { text: clipped, originalLength, truncated, redactions: redacted.redactions };
  };
}

/** Redacts, then truncates: truncating first could split a secret and leave half of it. */
export function redactForSharing(text: string, max: number): RedactedText {
  return prepareForSharing(text)(max);
}
