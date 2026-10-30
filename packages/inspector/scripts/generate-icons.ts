import fs from 'fs';
import path from 'path';
import prettier from 'prettier';
import { transformSvg } from '../src/components/Icons/figma/transform-svg';

const FIGMA = path.resolve(__dirname, '../src/components/Icons/figma');
const SVG = path.join(FIGMA, 'svg');
const CREATOR_HUB = path.resolve(
  __dirname,
  '../../creator-hub/renderer/src/components/Icons/figma/index.ts',
);
const FIXED_COLOURS = new Set(['Credits']);

type Icon = { base?: string; small?: string };

function readIcons() {
  const icons = new Map<string, Icon>();
  for (const file of fs.readdirSync(SVG).filter(file => file.endsWith('.svg'))) {
    const drawingName = file.slice(0, -'.svg'.length);
    const [name, variant] = drawingName.split('.');
    const { viewBox, jsx } = transformSvg(
      fs.readFileSync(path.join(SVG, file), 'utf8'),
      drawingName,
      {
        fixed: FIXED_COLOURS.has(name),
      },
    );
    const frame = viewBox.split(' ')[2];
    if (frame !== '16' && frame !== '24')
      throw new Error(`${file}: frame ${viewBox} is not 16 or 24`);
    const icon = icons.get(name) ?? {};
    if (variant === 'small') {
      icon.small = `{ path: ${jsx}, viewBox: '${frame === '16' ? '0 0 16 16' : '4 4 16 16'}' }`;
    } else if (variant === undefined) {
      icon.base = frame === '16' ? `<g transform="scale(1.5)">${jsx}</g>` : jsx;
    } else {
      throw new Error(`${file}: unknown drawing "${variant}"`);
    }
    icons.set(name, icon);
  }
  return new Map([...icons].sort(([a], [b]) => (a < b ? -1 : 1)));
}

function builderModule(icons: Map<string, Icon>) {
  const entries = [...icons].map(([name, { base, small }]) => {
    if (!base) throw new Error(`${name}: a small drawing with no base drawing`);
    return `${name}: createSvgIcon(${base}, '${name}'${small ? `, ${small}` : ''}),`;
  });
  return `import type { ReactNode } from 'react';

export type IconDrawing = { path: ReactNode; viewBox: string };

export type IconFactory<C> = (path: ReactNode, displayName: string, small?: IconDrawing) => C;

/** Builds the Figma icon set, one component per icon, with a world's own \`createSvgIcon\`. */
export function createIconSet<C>(createSvgIcon: IconFactory<C>) {
  return {
    ${entries.join('\n')}
  };
}
`;
}

const boundModule = (names: string[], imports: string) =>
  `${imports}

export const { ${names.join(', ')} } = createIconSet(createSvgIcon);
`;

async function write(file: string, source: string) {
  const config = await prettier.resolveConfig(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await prettier.format(source, { ...config, filepath: file }));
}

async function main() {
  const icons = readIcons();
  const names = [...icons.keys()];
  await write(path.join(FIGMA, 'icon-set.generated.tsx'), builderModule(icons));
  await write(
    path.join(FIGMA, 'index.ts'),
    boundModule(
      names,
      `import { createSvgIcon } from './createSvgIcon';
import { createIconSet } from './icon-set.generated';

export { SvgIcon } from './SvgIcon';
export { createSvgIcon };`,
    ),
  );
  await write(
    CREATOR_HUB,
    boundModule(
      names,
      `import { createIconSet } from '@dcl/inspector/icons';
import { createSvgIcon } from './createSvgIcon';`,
    ),
  );
  console.log(`Generated ${names.length} icons from ${SVG}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
