import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSync as wasmParse } from '@oxc-parser/wasm/node/oxc_parser_wasm.js';
import { build } from 'esbuild';
import { parseSync as nativeParse } from 'oxc-parser';
import { describe, expect, it, vi } from 'vitest';

import {
  generateRootComponent,
  generateUiIndex,
} from '../../../components/UIDesigner/code/aggregator';

// The dev-only browser fallback (./wasm.ts) parses with @oxc-parser/wasm while
// production parses with native oxc-parser in CH main. The splice engine edits
// source by AST span, so the two must agree EXACTLY — a shape or offset
// difference would silently corrupt scene files in one environment only.
// Drift guard: if oxc-parser and @oxc-parser/wasm ever fall out of lockstep
// (a version bump on one side), this fails instead of the canvas.

const AUTHORED = `/** @jsx ReactEcs.createElement */
import ReactEcs, { Button, Input, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export interface State {
  score: number
  name: string
}
export const state: State = { score: 0, name: 'Ünïcödé ✨' }

/** @ui-action */
export function onPress() {
  state.score += 1
}

export function MyScreen(props: { title?: string }) {
  const styles = useInteraction({
    base: { uiBackground: { color: Color4.create(1, 0, 0, 1) } },
    hover: { uiBackground: { color: Color4.Blue() }, uiTransform: { width: 120 } },
  })
  return (
    <UiEntity
      uiTransform={{ width: '100%', height: 64, margin: { top: 4, left: '2%' } }}
      uiBackground={{ textureMode: 'stretch', texture: { src: 'images/á.png' } }}
      {...styles}
    >
      {/* a jsx comment */}
      <Label value={\`score: \${state.score}\`} fontSize={14} />
      <Button value="Prêss" variant="primary" onMouseDown={onPress} />
      <Input onChange={v => (state.name = v)} placeholder="tÿpe hére…" />
      {state.score > 0 ? <Label value="ünïcode ✓" /> : null}
    </UiEntity>
  )
}
`;

const FIXTURES: Record<string, string> = {
  'src/ui/MyScreen.tsx': AUTHORED,
  'src/ui/Generated.tsx': generateRootComponent('Generated'),
  'src/ui/index.tsx': generateUiIndex([
    { component: 'Generated', module: './Generated' },
    { component: 'MyScreen', module: './MyScreen' },
  ]),
};

describe('when parsing the same source with the native and wasm oxc parsers', () => {
  for (const [filename, source] of Object.entries(FIXTURES)) {
    it(`should produce an identical AST and comments for ${filename}`, () => {
      const native = nativeParse(filename, source);
      const wasm = wasmParse(source, { sourceFilename: filename });

      expect(native.errors).toHaveLength(0);
      expect(wasm.errors).toHaveLength(0);
      expect(JSON.stringify(wasm.program)).toEqual(JSON.stringify(native.program));
      expect(wasm.comments).toEqual(native.comments);
    });
  }

  it('should report a syntax error from both parsers', () => {
    const broken = AUTHORED.replace('return (', 'return (((');
    expect(nativeParse('src/ui/MyScreen.tsx', broken).errors.length).toBeGreaterThan(0);
    expect(
      wasmParse(broken, { sourceFilename: 'src/ui/MyScreen.tsx' }).errors.length,
    ).toBeGreaterThan(0);
  });

  it('should give spans that index into the source string, not utf-8 bytes', () => {
    const { program } = wasmParse(AUTHORED, { sourceFilename: 'src/ui/MyScreen.tsx' });
    const spans: { start: number; end: number }[] = [];
    JSON.stringify(program, (_k, v) => {
      if (v && v.type === 'Literal' && typeof v.value === 'string') spans.push(v);
      return v;
    });
    const unicode = spans.find(s => AUTHORED.slice(s.start, s.end).includes('ünïcode ✓'));
    expect(unicode).toBeDefined();
  });
});

const REAL_WASM = readFileSync(
  createRequire(import.meta.url).resolve('@oxc-parser/wasm/web/oxc_parser_wasm_bg.wasm'),
);
let wasmBytes: Uint8Array = REAL_WASM;

// The build inlines the .wasm as bytes (esbuild's binary loader); vite hands the
// spec a URL there, which the web `init` would try to fetch. Reading through a
// getter also lets a case feed `init` bytes that cannot instantiate.
vi.mock('@oxc-parser/wasm/web/oxc_parser_wasm_bg.wasm', () => ({
  get default() {
    return wasmBytes;
  },
}));

// Each case needs its own module instance: `ready` is module state.
async function freshParser() {
  vi.resetModules();
  return (await import('./wasm')).wasmCodeParser;
}

describe('when parsing through the dev parser', () => {
  it('should return an AST that outlives the freed wasm result', async () => {
    const parser = await freshParser();
    const { program, comments, errors } = await parser.parse('src/ui/MyScreen.tsx', AUTHORED);
    const native = nativeParse('src/ui/MyScreen.tsx', AUTHORED);
    expect(errors).toHaveLength(0);
    expect(JSON.stringify(program)).toEqual(JSON.stringify(native.program));
    expect(comments).toEqual(native.comments);
  });

  // A cached rejection would disable code mode for the lifetime of the tab.
  it('should retry a failed init on the next parse', async () => {
    const parser = await freshParser();
    wasmBytes = new Uint8Array([0, 0, 0, 0]);
    await expect(parser.parse('a.tsx', 'const a = 1')).rejects.toThrow();

    wasmBytes = REAL_WASM;
    const { errors } = await parser.parse('a.tsx', 'const a = 1');
    expect(errors).toHaveLength(0);
  });
});

// The wasm parser is dev-only, and the ~740KB payload stays out of production
// bundles purely because esbuild drops a dynamic import that sits in a dead
// `INSPECTOR_DEV_PARSER` branch. Bundling the entry both ways is the only check
// that survives a refactor of that branch (a static import would ship it).
describe('when bundling the code parser for production', () => {
  async function bundle(devParser: boolean): Promise<string> {
    const result = await build({
      entryPoints: [resolve(__dirname, 'index.ts')],
      bundle: true,
      platform: 'browser',
      write: false,
      loader: { '.wasm': 'binary' },
      define: { INSPECTOR_DEV_PARSER: JSON.stringify(devParser) },
    });
    return result.outputFiles[0].text;
  }

  it('should exclude the wasm parser', async () => {
    expect(await bundle(false)).not.toContain('oxc_parser_wasm');
  });

  it('should include it in a dev bundle', async () => {
    expect(await bundle(true)).toContain('oxc_parser_wasm');
  });
});
