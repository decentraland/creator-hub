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

  it('is idempotent', async () => {
    const once = await formatUiSource(MESSY);
    expect(await formatUiSource(once)).toBe(once);
  });

  it('returns broken source unchanged (loadAndParse surfaces the error)', async () => {
    const broken = 'export function X() { return <UiEntity }';
    expect(await formatUiSource(broken)).toBe(broken);
  });
});
