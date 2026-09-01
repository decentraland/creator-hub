import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_AUTO,
  YGU_PERCENT,
  YGU_POINT,
} from '../../../lib/sdk/ui-transform-constants';

type Len = number | string;

function toLenUnit(v: Len | undefined): { value?: number; unit?: number } {
  if (typeof v === 'number') return { value: v, unit: YGU_POINT };
  if (typeof v === 'string') {
    if (v === 'auto') return { value: 0, unit: YGU_AUTO };
    if (v.endsWith('%')) return { value: parseFloat(v), unit: YGU_PERCENT };
    const n = parseFloat(v);
    if (Number.isFinite(n)) return { value: n, unit: YGU_POINT };
  }
  return {};
}

const EDGES = ['Top', 'Right', 'Bottom', 'Left'] as const;

function shorthandToEdges(v: number | string): Record<string, Len> | undefined {
  if (typeof v === 'number') return { top: v, right: v, bottom: v, left: v };
  const parts = v.trim().split(/\s+/);
  const [a, b, c, d] = parts;
  switch (parts.length) {
    case 1:
      return { top: a, right: a, bottom: a, left: a };
    case 2:
      return { top: a, right: b, bottom: a, left: b };
    case 3:
      return { top: a, right: b, bottom: c, left: b };
    case 4:
      return { top: a, right: b, bottom: c, left: d };
    default:
      return undefined;
  }
}

function writeEdges(pb: Record<string, unknown>, prefix: string, input: unknown): void {
  const obj =
    typeof input === 'number' || typeof input === 'string' ? shorthandToEdges(input) : input;
  if (!obj || typeof obj !== 'object') return;
  const rec = obj as Record<string, Len | undefined>;
  for (const edge of EDGES) {
    const { value, unit } = toLenUnit(rec[edge.toLowerCase()]);
    if (value !== undefined && unit !== undefined) {
      pb[`${prefix}${edge}`] = value;
      pb[`${prefix}${edge}Unit`] = unit;
    }
  }
}

const DIMENSIONS = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'flexBasis',
];

const ALIGN_ENUM: Record<number, string> = {
  0: 'auto',
  1: 'flex-start',
  2: 'center',
  3: 'flex-end',
  4: 'stretch',
  5: 'baseline',
  6: 'space-between',
  7: 'space-around',
};

const ENUM_TO_STRING: Record<string, Record<number, string>> = {
  display: { 0: 'flex', 1: 'none' },
  flexDirection: { 0: 'row', 1: 'column', 2: 'column-reverse', 3: 'row-reverse' },
  justifyContent: {
    0: 'flex-start',
    1: 'center',
    2: 'flex-end',
    3: 'space-between',
    4: 'space-around',
    5: 'space-evenly',
  },
  alignItems: ALIGN_ENUM,
  alignSelf: ALIGN_ENUM,
  alignContent: ALIGN_ENUM,
  flexWrap: { 0: 'nowrap', 1: 'wrap', 2: 'wrap-reverse' },
  overflow: { 0: 'visible', 1: 'hidden', 2: 'scroll' },
  pointerFilter: { 0: 'none', 1: 'block' },
};

const SCALAR_PROPS = ['flexGrow', 'flexShrink', 'opacity', 'zIndex'] as const;

const RADIUS_CORNERS = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'] as const;

function writeBorderRadius(pb: Record<string, unknown>, v: unknown): void {
  const perCorner =
    typeof v === 'number' || typeof v === 'string'
      ? { topLeft: v, topRight: v, bottomLeft: v, bottomRight: v }
      : v && typeof v === 'object'
        ? (v as Record<string, Len | undefined>)
        : undefined;
  if (!perCorner) return;
  for (const corner of RADIUS_CORNERS) {
    const key = corner[0].toLowerCase() + corner.slice(1);
    const { value, unit } = toLenUnit(perCorner[key]);
    if (value !== undefined && unit !== undefined) {
      pb[`border${corner}Radius`] = value;
      pb[`border${corner}RadiusUnit`] = unit;
    }
  }
}

function writeBorderWidth(pb: Record<string, unknown>, v: unknown): void {
  const perEdge =
    typeof v === 'number' || typeof v === 'string'
      ? { top: v, right: v, bottom: v, left: v }
      : v && typeof v === 'object'
        ? (v as Record<string, Len | undefined>)
        : undefined;
  if (!perEdge) return;
  for (const edge of EDGES) {
    const { value, unit } = toLenUnit(perEdge[edge.toLowerCase()]);
    if (value !== undefined && unit !== undefined) {
      pb[`border${edge}Width`] = value;
      pb[`border${edge}WidthUnit`] = unit;
    }
  }
}

const isColorLike = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).r === 'number';

function writeBorderColor(pb: Record<string, unknown>, v: unknown): void {
  const perEdge = isColorLike(v)
    ? { top: v, right: v, bottom: v, left: v }
    : v && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : undefined;
  if (!perEdge) return;
  for (const edge of EDGES) {
    const c = perEdge[edge.toLowerCase()];
    if (isColorLike(c)) pb[`border${edge}Color`] = c;
  }
}

const STRING_TO_ENUM: Record<string, Record<string, number>> = Object.fromEntries(
  Object.entries(ENUM_TO_STRING).map(([prop, m]) => [
    prop,
    Object.fromEntries(Object.entries(m).map(([num, str]) => [str, Number(num)])),
  ]),
);

export function ergonomicToPBTransform(ergo: Record<string, unknown>): Record<string, unknown> {
  const pb: Record<string, unknown> = {};

  for (const dim of DIMENSIONS) {
    const { value, unit } = toLenUnit(ergo[dim] as Len | undefined);
    if (value !== undefined && unit !== undefined) {
      pb[dim] = value;
      pb[`${dim}Unit`] = unit;
    }
  }

  if (ergo.positionType === 'absolute') pb.positionType = YGPT_ABSOLUTE;
  else if (ergo.positionType === 'relative') pb.positionType = YGPT_RELATIVE;

  writeEdges(pb, 'position', ergo.position);
  writeEdges(pb, 'margin', ergo.margin);
  writeEdges(pb, 'padding', ergo.padding);

  writeBorderRadius(pb, ergo.borderRadius);
  writeBorderWidth(pb, ergo.borderWidth);
  writeBorderColor(pb, ergo.borderColor);

  for (const prop of SCALAR_PROPS) {
    if (typeof ergo[prop] === 'number') pb[prop] = ergo[prop];
  }

  for (const prop of Object.keys(ENUM_TO_STRING)) {
    const v = ergo[prop];
    if (typeof v === 'string') {
      const num = STRING_TO_ENUM[prop][v];
      if (num !== undefined) pb[prop] = num;
    }
  }

  return pb;
}

function pbLen(value: unknown, unit: unknown): Len | undefined {
  if (typeof value !== 'number') return undefined;
  if (unit === YGU_PERCENT) return `${value}%`;
  if (unit === YGU_AUTO) return 'auto';
  if (unit === YGU_POINT) return value;
  return undefined;
}

function foldGroup(
  entries: [key: string, value: unknown][],
): unknown | Record<string, unknown> | undefined {
  const present = entries.filter(([, v]) => v !== undefined);
  if (present.length === 0) return undefined;
  const first = JSON.stringify(present[0][1]);
  if (present.length === entries.length && present.every(([, v]) => JSON.stringify(v) === first)) {
    return present[0][1];
  }
  return Object.fromEntries(present);
}

export function pbToErgonomicTransform(pb: Record<string, unknown>): Record<string, unknown> {
  const ergo: Record<string, unknown> = {};

  for (const dim of DIMENSIONS) {
    const l = pbLen(pb[dim], pb[`${dim}Unit`]);
    if (l !== undefined) ergo[dim] = l;
  }

  if (pb.positionType === YGPT_ABSOLUTE) ergo.positionType = 'absolute';

  for (const prefix of ['position', 'margin', 'padding'] as const) {
    const edges: Record<string, Len> = {};
    for (const edge of EDGES) {
      const l = pbLen(pb[`${prefix}${edge}`], pb[`${prefix}${edge}Unit`]);
      if (l !== undefined) edges[edge.toLowerCase()] = l;
    }
    if (Object.keys(edges).length > 0) ergo[prefix] = edges;
  }

  const radius = foldGroup(
    RADIUS_CORNERS.map((corner): [string, unknown] => [
      corner[0].toLowerCase() + corner.slice(1),
      pbLen(pb[`border${corner}Radius`], pb[`border${corner}RadiusUnit`]),
    ]),
  );
  if (radius !== undefined) ergo.borderRadius = radius;

  const width = foldGroup(
    EDGES.map((edge): [string, unknown] => [
      edge.toLowerCase(),
      pbLen(pb[`border${edge}Width`], pb[`border${edge}WidthUnit`]),
    ]),
  );
  if (width !== undefined) ergo.borderWidth = width;

  const color = foldGroup(
    EDGES.map((edge): [string, unknown] => [
      edge.toLowerCase(),
      isColorLike(pb[`border${edge}Color`]) ? pb[`border${edge}Color`] : undefined,
    ]),
  );
  if (color !== undefined) ergo.borderColor = color;

  for (const prop of SCALAR_PROPS) {
    if (typeof pb[prop] === 'number') ergo[prop] = pb[prop];
  }

  for (const prop of Object.keys(ENUM_TO_STRING)) {
    const v = pb[prop];
    if (typeof v === 'number') {
      const str = ENUM_TO_STRING[prop][v];
      if (str !== undefined) ergo[prop] = str;
    }
  }

  return ergo;
}

const TEXTURE_MODE_ENUM: Record<number, string> = { 0: 'nine-slices', 1: 'center', 2: 'stretch' };
const WRAP_ENUM: Record<number, string> = { 0: 'repeat', 1: 'clamp', 2: 'mirror' };
const FILTER_ENUM: Record<number, string> = { 0: 'point', 1: 'bi-linear', 2: 'tri-linear' };

const invert = (m: Record<number, string>): Record<string, number> =>
  Object.fromEntries(Object.entries(m).map(([n, s]) => [s, Number(n)]));

const TEXTURE_MODE_STR = invert(TEXTURE_MODE_ENUM);
const WRAP_STR = invert(WRAP_ENUM);
const FILTER_STR = invert(FILTER_ENUM);

type ErgoTexture = { src?: string; wrapMode?: string; filterMode?: string } & Record<
  string,
  unknown
>;

function ergoTextureToPB(t: ErgoTexture): Record<string, unknown> {
  const out: Record<string, unknown> = { ...t };
  if (typeof t.wrapMode === 'string') out.wrapMode = WRAP_STR[t.wrapMode];
  if (typeof t.filterMode === 'string') out.filterMode = FILTER_STR[t.filterMode];
  return out;
}

function pbTextureToErgo(t: Record<string, unknown>): ErgoTexture {
  const out: ErgoTexture = { ...t };
  if (typeof t.wrapMode === 'number') out.wrapMode = WRAP_ENUM[t.wrapMode];
  if (typeof t.filterMode === 'number') out.filterMode = FILTER_ENUM[t.filterMode];
  return out;
}

export function ergonomicToPBBackground(ergo: Record<string, unknown>): Record<string, unknown> {
  const pb: Record<string, unknown> = { ...ergo };
  if (typeof ergo.textureMode === 'string') {
    const n = TEXTURE_MODE_STR[ergo.textureMode];
    if (n !== undefined) pb.textureMode = n;
    else delete pb.textureMode;
  }
  delete pb.texture;
  delete pb.avatarTexture;
  if (ergo.texture && typeof ergo.texture === 'object') {
    pb.texture = {
      tex: { $case: 'texture', texture: ergoTextureToPB(ergo.texture as ErgoTexture) },
    };
  } else if (ergo.avatarTexture && typeof ergo.avatarTexture === 'object') {
    pb.texture = {
      tex: {
        $case: 'avatarTexture',
        avatarTexture: ergoTextureToPB(ergo.avatarTexture as ErgoTexture),
      },
    };
  }
  return pb;
}

function pbBackgroundFieldToErgo(
  key: string,
  value: unknown,
): { key: string; value: unknown } | null {
  if (key === 'textureMode') {
    if (value == null) return { key, value: undefined };
    if (typeof value !== 'number') return null;
    const s = TEXTURE_MODE_ENUM[value];
    return s !== undefined ? { key, value: s } : null;
  }
  if (key === 'texture') {
    if (value == null) return { key, value: undefined };
    const tex = (value as { tex?: { $case?: string; [k: string]: unknown } }).tex;
    if (!tex || typeof tex !== 'object') return null;
    if (tex.$case === 'texture' && tex.texture && typeof tex.texture === 'object') {
      return { key: 'texture', value: pbTextureToErgo(tex.texture as Record<string, unknown>) };
    }
    if (
      tex.$case === 'avatarTexture' &&
      tex.avatarTexture &&
      typeof tex.avatarTexture === 'object'
    ) {
      return {
        key: 'avatarTexture',
        value: pbTextureToErgo(tex.avatarTexture as Record<string, unknown>),
      };
    }
    return null;
  }
  return { key, value };
}

export function pbBackgroundPatchToErgoFields(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of ['color', 'texture', 'textureMode', 'textureSlices', 'uvs']) {
    if (!(key in patch)) continue;
    const ergo = pbBackgroundFieldToErgo(key, patch[key]);
    if (!ergo) {
      console.warn(`[code-mode] uiBackground.${key}: value not expressible in react-ecs — skipped`);
      continue;
    }
    if (ergo.key === 'texture' || ergo.key === 'avatarTexture') {
      fields.texture = undefined;
      fields.avatarTexture = undefined;
    }
    fields[ergo.key] = ergo.value;
  }
  return fields;
}

const TEXT_ALIGN_ENUM: Record<number, string> = {
  0: 'top-left',
  1: 'top-center',
  2: 'top-right',
  3: 'middle-left',
  4: 'middle-center',
  5: 'middle-right',
  6: 'bottom-left',
  7: 'bottom-center',
  8: 'bottom-right',
};

const FONT_ENUM: Record<number, string> = { 0: 'sans-serif', 1: 'serif', 2: 'monospace' };

const TEXT_WRAP_ENUM: Record<number, string> = { 0: 'wrap', 1: 'nowrap' };

const TEXT_ALIGN_STR: Record<string, number> = Object.fromEntries(
  Object.entries(TEXT_ALIGN_ENUM).map(([n, s]) => [s, Number(n)]),
);
const FONT_STR: Record<string, number> = Object.fromEntries(
  Object.entries(FONT_ENUM).map(([n, s]) => [s, Number(n)]),
);
const TEXT_WRAP_STR: Record<string, number> = Object.fromEntries(
  Object.entries(TEXT_WRAP_ENUM).map(([n, s]) => [s, Number(n)]),
);

export function ergonomicToPBText(ergo: Record<string, unknown>): Record<string, unknown> {
  const pb: Record<string, unknown> = { ...ergo };
  if (typeof ergo.textAlign === 'string') {
    const n = TEXT_ALIGN_STR[ergo.textAlign];
    if (n !== undefined) pb.textAlign = n;
    else delete pb.textAlign;
  }
  if (typeof ergo.font === 'string') {
    const n = FONT_STR[ergo.font];
    if (n !== undefined) pb.font = n;
    else delete pb.font;
  }
  if (typeof ergo.textWrap === 'string') {
    const n = TEXT_WRAP_STR[ergo.textWrap];
    if (n !== undefined) pb.textWrap = n;
    else delete pb.textWrap;
  }
  return pb;
}

export function pbToErgonomicText(pb: Record<string, unknown>): Record<string, unknown> {
  const ergo: Record<string, unknown> = { ...pb };
  if (typeof pb.textAlign === 'number') {
    const s = TEXT_ALIGN_ENUM[pb.textAlign];
    if (s !== undefined) ergo.textAlign = s;
    else delete ergo.textAlign;
  }
  if (typeof pb.font === 'number') {
    const s = FONT_ENUM[pb.font];
    if (s !== undefined) ergo.font = s;
    else delete ergo.font;
  }
  if (typeof pb.textWrap === 'number') {
    const s = TEXT_WRAP_ENUM[pb.textWrap];
    if (s !== undefined) ergo.textWrap = s;
    else delete ergo.textWrap;
  }
  return ergo;
}

export const BUTTON_VARIANT_ENUM: Record<number, string> = { 0: 'primary', 1: 'secondary' };

const BUTTON_VARIANT_STR = invert(BUTTON_VARIANT_ENUM);

export function ergonomicToPBButton(ergo: Record<string, unknown>): Record<string, unknown> {
  const pb: Record<string, unknown> = { ...ergo };
  if (typeof ergo.variant === 'string') {
    const n = BUTTON_VARIANT_STR[ergo.variant];
    if (n !== undefined) pb.variant = n;
    else delete pb.variant;
  }
  return pb;
}

export function pbToErgonomicButton(pb: Record<string, unknown>): Record<string, unknown> {
  const ergo: Record<string, unknown> = { ...pb };
  if (typeof pb.variant === 'number') {
    const s = BUTTON_VARIANT_ENUM[pb.variant];
    if (s !== undefined) ergo.variant = s;
    else delete ergo.variant;
  }
  return ergo;
}
