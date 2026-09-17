import type React from 'react';

import {
  YGD_NONE,
  YGPT_ABSOLUTE,
  YGU_AUTO,
  YGU_PERCENT,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../../lib/sdk/ui-transform-constants';
import type { FieldConfig } from '../RightPanel/PropertyPanel/field-configs';
import type { UINode, UINodeType } from '../shared/tree-model';

const BTM_CENTER = 1;

const FLEX_DIRECTION: Record<number, React.CSSProperties['flexDirection']> = {
  0: 'row',
  1: 'column',
  2: 'column-reverse',
  3: 'row-reverse',
};

const JUSTIFY_CONTENT: Record<number, React.CSSProperties['justifyContent']> = {
  0: 'flex-start',
  1: 'center',
  2: 'flex-end',
  3: 'space-between',
  4: 'space-around',
  5: 'space-evenly',
};

const FLEX_WRAP: Record<number, React.CSSProperties['flexWrap']> = {
  0: 'nowrap',
  1: 'wrap',
  2: 'wrap-reverse',
};

const ALIGN: Record<number, string> = {
  0: 'auto',
  1: 'flex-start',
  2: 'center',
  3: 'flex-end',
  4: 'stretch',
  5: 'baseline',
  6: 'space-between',
  7: 'space-around',
};

const OVERFLOW: Record<number, React.CSSProperties['overflow']> = {
  0: 'visible',
  1: 'hidden',
  2: 'scroll',
};

export const rendersText = (type: UINodeType): boolean => type === 'Label' || type === 'Button';

const TEXT_ALIGN_H: Record<number, React.CSSProperties['textAlign']> = {
  0: 'left',
  1: 'center',
  2: 'right',
  3: 'left',
  4: 'center',
  5: 'right',
  6: 'left',
  7: 'center',
  8: 'right',
};

const TEXT_ALIGN_FLEX: Record<
  number,
  {
    justifyContent: React.CSSProperties['justifyContent'];
    alignItems: React.CSSProperties['alignItems'];
  }
> = {
  0: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  1: { justifyContent: 'center', alignItems: 'flex-start' },
  2: { justifyContent: 'flex-end', alignItems: 'flex-start' },
  3: { justifyContent: 'flex-start', alignItems: 'center' },
  4: { justifyContent: 'center', alignItems: 'center' },
  5: { justifyContent: 'flex-end', alignItems: 'center' },
  6: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  7: { justifyContent: 'center', alignItems: 'flex-end' },
  8: { justifyContent: 'flex-end', alignItems: 'flex-end' },
};

const FONT_FAMILY: Record<number, string> = {
  0: 'sans-serif',
  1: 'serif',
  2: 'monospace',
};

function cssLen(value: number | undefined, unit: number | undefined): string | undefined {
  if (value === undefined || unit === undefined) return undefined;
  if (unit === YGU_UNDEFINED) return undefined;
  if (unit === YGU_AUTO) return 'auto';
  if (unit === YGU_PERCENT) return `${value}%`;
  if (unit === YGU_POINT) return `${value}px`;
  return undefined;
}

function color4ToRgba(c: { r: number; g: number; b: number; a?: number }): string {
  const a = c.a ?? 1;
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
}

const DEFAULT_BORDER_COLOR = { r: 0, g: 0, b: 0, a: 1 };

export const TEXT_VALUE_FIELD: FieldConfig = {
  label: 'Text',
  componentId: 'core::UiText',
  path: 'value',
  kind: 'string',
  mixable: true,
};

export function nodeStyle(node: UINode): React.CSSProperties {
  const t = (node.uiTransform ?? {}) as Record<string, number | undefined>;
  const b = (node.uiBackground ?? {}) as {
    color?: { r: number; g: number; b: number; a?: number };
  };
  const text = (node.uiText ?? {}) as {
    color?: { r: number; g: number; b: number; a?: number };
    fontSize?: number;
    textAlign?: number;
    font?: number;
  };

  const style: React.CSSProperties = {
    display: t.display === YGD_NONE ? 'none' : 'flex',
    position: t.positionType === YGPT_ABSOLUTE ? 'absolute' : 'relative',
    flexDirection: 'row',
    boxSizing: 'border-box',
  };

  if (t.flexDirection !== undefined && FLEX_DIRECTION[t.flexDirection]) {
    style.flexDirection = FLEX_DIRECTION[t.flexDirection];
  }
  if (t.justifyContent !== undefined && JUSTIFY_CONTENT[t.justifyContent]) {
    style.justifyContent = JUSTIFY_CONTENT[t.justifyContent];
  }
  if (t.flexWrap !== undefined && FLEX_WRAP[t.flexWrap]) {
    style.flexWrap = FLEX_WRAP[t.flexWrap];
  }
  if (t.alignItems !== undefined && ALIGN[t.alignItems]) {
    style.alignItems = ALIGN[t.alignItems] as React.CSSProperties['alignItems'];
  }
  if (t.alignSelf !== undefined && ALIGN[t.alignSelf]) {
    style.alignSelf = ALIGN[t.alignSelf] as React.CSSProperties['alignSelf'];
  }
  if (t.alignContent !== undefined && ALIGN[t.alignContent]) {
    style.alignContent = ALIGN[t.alignContent] as React.CSSProperties['alignContent'];
  }
  if (t.overflow !== undefined && OVERFLOW[t.overflow]) {
    style.overflow = OVERFLOW[t.overflow];
  }

  if (t.flexGrow !== undefined) style.flexGrow = t.flexGrow;
  if (t.flexShrink !== undefined) style.flexShrink = t.flexShrink;

  const flexBasis = cssLen(t.flexBasis, t.flexBasisUnit);
  if (flexBasis !== undefined) style.flexBasis = flexBasis;

  const width = cssLen(t.width, t.widthUnit);
  if (width !== undefined) style.width = width;
  const height = cssLen(t.height, t.heightUnit);
  if (height !== undefined) style.height = height;
  const minWidth = cssLen(t.minWidth, t.minWidthUnit);
  if (minWidth !== undefined) style.minWidth = minWidth;
  const maxWidth = cssLen(t.maxWidth, t.maxWidthUnit);
  if (maxWidth !== undefined) style.maxWidth = maxWidth;
  const minHeight = cssLen(t.minHeight, t.minHeightUnit);
  if (minHeight !== undefined) style.minHeight = minHeight;
  const maxHeight = cssLen(t.maxHeight, t.maxHeightUnit);
  if (maxHeight !== undefined) style.maxHeight = maxHeight;

  const paddingTop = cssLen(t.paddingTop, t.paddingTopUnit);
  if (paddingTop !== undefined) style.paddingTop = paddingTop;
  const paddingRight = cssLen(t.paddingRight, t.paddingRightUnit);
  if (paddingRight !== undefined) style.paddingRight = paddingRight;
  const paddingBottom = cssLen(t.paddingBottom, t.paddingBottomUnit);
  if (paddingBottom !== undefined) style.paddingBottom = paddingBottom;
  const paddingLeft = cssLen(t.paddingLeft, t.paddingLeftUnit);
  if (paddingLeft !== undefined) style.paddingLeft = paddingLeft;

  const marginTop = cssLen(t.marginTop, t.marginTopUnit);
  if (marginTop !== undefined) style.marginTop = marginTop;
  const marginRight = cssLen(t.marginRight, t.marginRightUnit);
  if (marginRight !== undefined) style.marginRight = marginRight;
  const marginBottom = cssLen(t.marginBottom, t.marginBottomUnit);
  if (marginBottom !== undefined) style.marginBottom = marginBottom;
  const marginLeft = cssLen(t.marginLeft, t.marginLeftUnit);
  if (marginLeft !== undefined) style.marginLeft = marginLeft;

  const top = cssLen(t.positionTop, t.positionTopUnit);
  if (top !== undefined) style.top = top;
  const right = cssLen(t.positionRight, t.positionRightUnit);
  if (right !== undefined) style.right = right;
  const bottom = cssLen(t.positionBottom, t.positionBottomUnit);
  if (bottom !== undefined) style.bottom = bottom;
  const left = cssLen(t.positionLeft, t.positionLeftUnit);
  if (left !== undefined) style.left = left;

  if (t.opacity !== undefined) style.opacity = t.opacity;
  if (t.zIndex !== undefined) style.zIndex = t.zIndex;

  const rTL = cssLen(t.borderTopLeftRadius, t.borderTopLeftRadiusUnit);
  const rTR = cssLen(t.borderTopRightRadius, t.borderTopRightRadiusUnit);
  const rBR = cssLen(t.borderBottomRightRadius, t.borderBottomRightRadiusUnit);
  const rBL = cssLen(t.borderBottomLeftRadius, t.borderBottomLeftRadiusUnit);
  if (rTL ?? rTR ?? rBR ?? rBL) {
    style.borderRadius = `${rTL ?? 0} ${rTR ?? 0} ${rBR ?? 0} ${rBL ?? 0}`;
  }

  const applyBorder = (
    side: 'Top' | 'Right' | 'Bottom' | 'Left',
    widthKey: keyof typeof t,
    unitKey: keyof typeof t,
    color: { r: number; g: number; b: number; a?: number } | undefined,
  ) => {
    const w = cssLen(t[widthKey], t[unitKey]);
    if (w !== undefined) {
      (style as Record<string, unknown>)[`border${side}Width`] = w;
      (style as Record<string, unknown>)[`border${side}Style`] = 'solid';
      (style as Record<string, unknown>)[`border${side}Color`] = color4ToRgba(
        color ?? DEFAULT_BORDER_COLOR,
      );
    }
  };
  const tc = t as Record<string, any>;
  applyBorder('Top', 'borderTopWidth', 'borderTopWidthUnit', tc.borderTopColor);
  applyBorder('Right', 'borderRightWidth', 'borderRightWidthUnit', tc.borderRightColor);
  applyBorder('Bottom', 'borderBottomWidth', 'borderBottomWidthUnit', tc.borderBottomColor);
  applyBorder('Left', 'borderLeftWidth', 'borderLeftWidthUnit', tc.borderLeftColor);

  if (b?.color) {
    style.backgroundColor = color4ToRgba(b.color);
  }
  if (text?.color) {
    style.color = color4ToRgba(text.color);
  }
  if (text?.fontSize !== undefined) {
    style.fontSize = `${text.fontSize}px`;
  }
  if (rendersText(node.type)) {
    const ta = typeof text.textAlign === 'number' ? text.textAlign : 4;
    const flex = TEXT_ALIGN_FLEX[ta] ?? TEXT_ALIGN_FLEX[4];
    style.justifyContent = flex.justifyContent;
    style.alignItems = flex.alignItems;
    style.textAlign = TEXT_ALIGN_H[ta] ?? 'center';
    if (text.font !== undefined && FONT_FAMILY[text.font]) {
      style.fontFamily = FONT_FAMILY[text.font];
    }
  } else if (text?.textAlign !== undefined && TEXT_ALIGN_H[text.textAlign]) {
    style.textAlign = TEXT_ALIGN_H[text.textAlign];
  }
  return style;
}

function safeTextureUrl(url: string): string | undefined {
  if (/["'()\\\s]/.test(url)) return undefined;
  if (!/^(blob:|https?:|data:image\/)/.test(url)) return undefined;
  return url;
}

export function textureStyle(
  url: string,
  textureMode: number | undefined,
  uvs: number[] | undefined,
): React.CSSProperties {
  const safe = safeTextureUrl(url);
  const base: React.CSSProperties = { backgroundRepeat: 'no-repeat' };
  if (safe) base.backgroundImage = `url("${safe}")`;
  if (textureMode === BTM_CENTER) {
    return { ...base, backgroundSize: 'auto', backgroundPosition: 'center' };
  }
  if (textureMode === 2 && uvs && uvs.length >= 8) {
    const us = [uvs[0], uvs[2], uvs[4], uvs[6]];
    const vs = [uvs[1], uvs[3], uvs[5], uvs[7]];
    const uMin = Math.min(...us);
    const uMax = Math.max(...us);
    const vMin = Math.min(...vs);
    const vMax = Math.max(...vs);
    const rw = uMax - uMin;
    const rh = vMax - vMin;
    if (rw > 0 && rh > 0 && (rw < 1 || rh < 1)) {
      const posX = rw < 1 ? (uMin / (1 - rw)) * 100 : 0;
      const posY = rh < 1 ? ((1 - vMax) / (1 - rh)) * 100 : 0;
      return {
        ...base,
        backgroundSize: `${(1 / rw) * 100}% ${(1 / rh) * 100}%`,
        backgroundPosition: `${posX}% ${posY}%`,
      };
    }
  }
  return { ...base, backgroundSize: '100% 100%' };
}

export const hiddenStyle = (style: React.CSSProperties, hidden?: boolean): React.CSSProperties =>
  hidden ? { ...style, visibility: 'hidden' } : style;
