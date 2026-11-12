import type { RedactedText } from '../types/ai-sharing';
import { BIP39_ENGLISH } from './bip39-english';

/**
 * Removes secrets and personal details from text the user agreed to share, before it is
 * written to disk or leaves the machine. Each rule swaps a match for `<kind>` and counts it.
 *
 * The rules are tuned against `tests/redact.test.ts`, which has two sides: text that must be
 * redacted, and ordinary scene code that must survive untouched. A rule that mangles scene
 * code makes the shared data useless, so changing one means running both sides.
 */

interface Rule {
  kind: string;
  pattern: RegExp;
  /** Return null to keep the match as it is. */
  replace?: (match: string, ...groups: string[]) => string | null;
}

const RULES: Rule[] = [
  {
    kind: 'private_key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  },
  { kind: 'private_key', pattern: /\b0x[0-9a-fA-F]{64}\b/g },
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
    replace: (_m, scheme) => `${scheme}<credential>@`,
  },
  {
    kind: 'credential',
    pattern:
      /([?&](?:token|key|api_key|apikey|sig|signature|secret|password|access_token)=)[^&\s#]+/gi,
    replace: (_m, prefix) => `${prefix}<credential>`,
  },
  {
    kind: 'credential',
    pattern:
      /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD)[A-Z0-9_]*\s*[=:]\s*)(["']?)[^\s"']{6,}\2/g,
    replace: (_m, prefix) => `${prefix}<credential>`,
  },
  {
    kind: 'credential',
    pattern: /(Bearer\s+)[\w.~+/=-]{8,}/gi,
    replace: (_m, p) => `${p}<credential>`,
  },
  { kind: 'email', pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}\b/g },
  { kind: 'phone', pattern: /(?<![\w.-])\+\d{1,3}(?:[\s.-]\(?\d{2,4}\)?){2,4}(?![\w.-])/g },
  {
    kind: 'phone',
    pattern: /(?<![\w.-])(?:\(\d{2,4}\)\s?|\d{2,4}[\s.-])\d{3,4}[-.]\d{3,4}(?![\w.-])/g,
  },
  {
    kind: 'ip',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    replace: m => (m === '127.0.0.1' || m === '0.0.0.0' ? null : '<ip>'),
  },
  {
    kind: 'home_path',
    pattern: /(\/Users\/|\/home\/|[A-Za-z]:\\Users\\)([^/\\\s'"`]+)/g,
    replace: (_m, root) => `${root}<user>`,
  },
];

const MIN_SEED_WORDS = 12;

const isSeedWord = (token: string): boolean =>
  BIP39_ENGLISH.has(token.toLowerCase().replace(/^["'(]+|[.,;:"')]+$/g, ''));

/** Replaces any run of 12+ consecutive BIP-39 words, the shape of a wallet recovery phrase. */
function redactSeedPhrases(text: string, counts: Record<string, number>): string {
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let run = 0;
    let j = i;
    while (j < tokens.length && isSeedWord(tokens[j])) {
      run++;
      j += 2;
    }
    if (run >= MIN_SEED_WORDS) {
      out.push('<seed_phrase>');
      counts.seed_phrase = (counts.seed_phrase ?? 0) + 1;
      i = j - 1;
      continue;
    }
    out.push(tokens[i]);
    i++;
  }
  return out.join('');
}

// No `/` or `.`: asset paths like `assets/models/tree01/bark_02.png` are long and mixed but safe.
const HIGH_ENTROPY_CANDIDATE = /[A-Za-z0-9_=-]{32,}/g;
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
  const hasDigit = /\d/.test(token);
  const hasLetter = /[A-Za-z]/.test(token);
  return hasDigit && hasLetter && shannonEntropy(token) >= 4.2;
}

export function redactText(text: string): { text: string; redactions: Record<string, number> } {
  const counts: Record<string, number> = {};
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (match: string, ...rest: unknown[]) => {
      const groups = rest.filter((g): g is string => typeof g === 'string');
      const replacement = rule.replace ? rule.replace(match, ...groups) : `<${rule.kind}>`;
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

/** Keeps the head and tail of text over `max` characters, never splitting a surrogate pair. */
export function truncateMiddle(text: string, max: number): { text: string; truncated: boolean } {
  const chars = Array.from(text);
  if (chars.length <= max) return { text, truncated: false };
  const head = Math.floor(max * 0.75);
  const tail = max - head;
  const cut = chars.length - head - tail;
  return {
    text: `${chars.slice(0, head).join('')}[… ${cut} chars cut …]${chars.slice(-tail).join('')}`,
    truncated: true,
  };
}

/** Redacts, then truncates: truncating first could split a secret and leave half of it. */
export function redactForSharing(text: string, max: number): RedactedText {
  const redacted = redactText(text);
  const { text: clipped, truncated } = truncateMiddle(redacted.text, max);
  return {
    text: clipped,
    originalLength: Array.from(text).length,
    truncated,
    redactions: redacted.redactions,
  };
}
