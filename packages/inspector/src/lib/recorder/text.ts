type Vec3 = { x: number; y: number; z: number };
type Quat = Vec3 & { w: number };

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatVector(v: Vec3, digits = 2, unit = ''): string {
  return `(${round(v.x, digits)}${unit}, ${round(v.y, digits)}${unit}, ${round(v.z, digits)}${unit})`;
}

function normalizeDegrees(radians: number): number {
  const degrees = round((radians * 180) / Math.PI, 1);
  const positive = degrees < 0 ? degrees + 360 : degrees;
  return positive >= 360 ? 0 : positive;
}

// Babylon's `Quaternion.toEulerAngles` (YXZ), so the degrees read exactly like the
// Transform inspector's rotation fields — the user and the LLM see the same numbers.
export function quaternionToEulerDegrees(q: Quat): Vec3 {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  const zAxisY = qy * qz - qx * qw;
  const limit = 0.4999999;
  if (zAxisY < -limit || zAxisY > limit) {
    return {
      x: normalizeDegrees(zAxisY < 0 ? Math.PI / 2 : -Math.PI / 2),
      y: normalizeDegrees(2 * Math.atan2(qy, qw)),
      z: 0,
    };
  }
  const sqw = qw * qw;
  const sqz = qz * qz;
  const sqx = qx * qx;
  const sqy = qy * qy;
  return {
    x: normalizeDegrees(Math.asin(-2 * zAxisY)),
    y: normalizeDegrees(Math.atan2(2 * (qz * qx + qy * qw), sqz - sqx - sqy + sqw)),
    z: normalizeDegrees(Math.atan2(2 * (qx * qy + qz * qw), -sqz - sqx + sqy + sqw)),
  };
}

type TransformLike = { position?: Vec3; rotation?: Quat; scale?: Vec3 };

export function summariseTransform(value: TransformLike): string {
  const parts: string[] = [];
  if (value.position) parts.push(`position ${formatVector(value.position)}`);
  if (value.rotation) {
    parts.push(`rotation ${formatVector(quaternionToEulerDegrees(value.rotation), 1, '°')}`);
  }
  if (value.scale) parts.push(`scale ${formatVector(value.scale)}`);
  return parts.join(', ');
}

export function shortJson(value: unknown, max = 120): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    json = undefined;
  }
  return truncate(json ?? String(value), max);
}

export function entityLabel(name: string, id: number): string {
  return `${name} (#${id})`;
}

export function listWithMore(items: string[], max: number): string {
  const shown = items.slice(0, max).join(', ');
  return items.length > max ? `${shown}, …` : shown;
}

/** `AddComponentTrigger` → `Add Component Trigger`. */
export function humanizeIdentifier(identifier: string): string {
  return collapseWhitespace(
    identifier
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'),
  );
}
