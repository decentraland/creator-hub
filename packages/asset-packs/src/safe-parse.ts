// Single source of the composite-JSON hardening shared by the runtime
// (ui-runtime.ts `decodeDesign`) and the inspector migration
// (ui-design-migration.ts `splitUIDesignToCore`). Previously duplicated in both
// with a "keep IN LOCKSTEP" comment — centralized here so the dangerous-key set
// can't drift between the two.

// Keys an attacker could place in composite JSON to attempt prototype pollution;
// stripped from every decoded object before it reaches createOrReplace. Variable-key
// delete avoids the linter's no-proto literal-access rule.
export const DANGEROUS_KEYS = ['__proto__', 'prototype', 'constructor'];

export interface SafeParseLog {
  // Prefix identifying the caller in the fallback warning (e.g. 'decodeDesign').
  label: string;
  // Emits the warning. The runtime uses console.error; the inspector console.warn.
  warn: (message: string) => void;
}

const DEFAULT_LOG: SafeParseLog = { label: 'safeParse', warn: msg => console.error(msg) };

// The composite JSON is attacker-controllable; a malformed UIDesign string field must not
// throw out of the caller (the per-frame runtime system / the inspector's scene load), nor
// reach a core::* component as a wrong-shape value or with prototype-polluting keys. Parse
// defensively: on throw OR non-plain-object shape, log via `log` and fall back; otherwise
// strip dangerous keys and return. exported for unit tests.
export function safeParse<T>(
  raw: string | undefined,
  fallback: T,
  entity: number,
  field: string,
  log: SafeParseLog = DEFAULT_LOG,
): T {
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.warn(`${log.label}: malformed UIDesign.${field} on entity ${entity}; using fallback`);
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    log.warn(`${log.label}: non-object UIDesign.${field} on entity ${entity}; using fallback`);
    return fallback;
  }
  const obj = parsed as Record<string, unknown>;
  for (const k of DANGEROUS_KEYS) delete obj[k];
  return obj as T;
}
