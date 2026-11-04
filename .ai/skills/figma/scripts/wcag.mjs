#!/usr/bin/env node
/**
 * WCAG 2.x contrast ratio between two colours.
 *
 * @example node wcag.mjs <fg> <bg> [alpha]   e.g. node wcag.mjs '#fff' '#242129' 0.4
 * @example node wcag.mjs --self-test
 * fg and bg are #rgb or #rrggbb; alpha (0–1, default 1) composites fg over bg first.
 */

const parse = value => {
  const hex = String(value).replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(hex) ? [...hex].map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a #rgb or #rrggbb colour: ${value}`);
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
};

const channel = c => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const composite = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

const contrast = (fg, bg, alpha = 1) => {
  const back = parse(bg);
  const front = composite(parse(fg), alpha, back);
  const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

const selfTest = () => {
  const cases = [
    ['#fff', '#000', 1, '21.00'],
    ['#63b4f6', '#242129', 1, '7.09'],
  ];
  const failures = cases.filter(([fg, bg, a, want]) => contrast(fg, bg, a).toFixed(2) !== want);
  for (const [fg, bg, a, want] of failures) {
    console.error(`FAIL ${fg} on ${bg}: ${contrast(fg, bg, a).toFixed(2)}, want ${want}`);
  }
  if (failures.length) process.exit(1);
  console.log(`self-test ok (${cases.length} cases)`);
};

const run = ([fg, bg, alpha]) => {
  if (fg === '--self-test') return selfTest();
  if (!fg || !bg) throw new Error('usage: node wcag.mjs <fg> <bg> [alpha] | --self-test');
  const a = alpha === undefined ? 1 : Number(alpha);
  if (!(a >= 0 && a <= 1)) throw new Error(`alpha must be between 0 and 1: ${alpha}`);
  console.log(`${contrast(fg, bg, a).toFixed(2)}:1`);
};

try {
  run(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
