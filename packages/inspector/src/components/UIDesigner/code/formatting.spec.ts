import { describe, expect, it } from 'vitest';

import { formatUiSource } from './formatting';

const MESSY = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'

/** @ui-bind */
let pruebita = "pruebita"

export function MainUI() {
  
  return (
    <UiEntity uiTransform={{ width: "100%", height: "100%" }}>
      <Label value={pruebita} fontSize={32} />
      
    
    
    <UiEntity uiTransform={{ width: 750, height: 340 }}>
  <Label value="nested" />
</UiEntity>
    </UiEntity>
  )
}
`;

describe('formatUiSource', () => {
  it('normalizes blank lines, indentation, and quotes', async () => {
    const out = await formatUiSource(MESSY);
    expect(out).not.toContain('\n  \n');
    expect(out).not.toContain('"100%"'); // double quotes → single
    expect(out).toContain("'100%'");
    expect(out).toContain('      <UiEntity uiTransform={{ width: 750, height: 340 }}>');
    expect(out).toContain('        <Label value="nested" />'); // JSX attrs keep double quotes
  });

  it('preserves the JSX pragma and @ui-* markers', async () => {
    const out = await formatUiSource(MESSY);
    expect(out).toContain('/** @jsx ReactEcs.createElement */');
    expect(out).toContain('/** @ui-bind */');
  });

  it('matches the generated-template style (no semicolons)', async () => {
    const out = await formatUiSource('const a = 1;\nexport function X() { return <UiEntity /> }\n');
    expect(out).toContain('const a = 1\n');
  });

  it('keeps a @ui-name marker inside its opening tag, which is the span it is read from, even when the tag wraps', async () => {
    const src = `export function MainUI() {
  return (
    <UiEntity /* @ui-name Sidebar */ uiTransform={{ width: 200, height: 100, position: { top: 10, left: 20 }, margin: { top: 4 } }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 0.1 } }}>
      <Label /* @ui-name Title */ value="x" />
    </UiEntity>
  )
}
`;
    const out = await formatUiSource(src);
    expect(out, 'the wide tag must wrap, or this asserts nothing').toContain('<UiEntity\n');
    for (const [tag, name] of [
      ['UiEntity', 'Sidebar'],
      ['Label', 'Title'],
    ]) {
      const open = out.slice(out.indexOf(`<${tag}`));
      expect(open.slice(0, open.indexOf('>'))).toContain(`/* @ui-name ${name} */`);
    }
  });

  it('is idempotent', async () => {
    const once = await formatUiSource(MESSY);
    expect(await formatUiSource(once)).toBe(once);
  });

  it('returns broken source unchanged (loadAndParse surfaces the error)', async () => {
    const broken = 'export function X() { return <UiEntity }';
    expect(await formatUiSource(broken)).toBe(broken);
  });
});
