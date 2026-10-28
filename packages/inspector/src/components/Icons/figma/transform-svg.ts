const DRAWN_WHITE = /^(white|#fff|#ffffff|#fcfcfc)$/i;

const camelCase = (name: string) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

function prefixIds(body: string, prefix: string) {
  const referenced = new Set(
    (body.match(/(?:url\(#|href="#)[^)"]+/g) ?? []).map(reference =>
      reference.replace(/^(?:url\(#|href="#)/, ''),
    ),
  );
  return body
    .replace(/ id="([^"]*)"/g, (_, id) => (referenced.has(id) ? ` id="${prefix}-${id}"` : ''))
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`);
}

function paintCurrentColor(body: string) {
  return body
    .split(/(<mask\b[\s\S]*?<\/mask>)/)
    .map(part =>
      part.startsWith('<mask')
        ? part
        : part.replace(/\b(fill|stroke)="([^"]+)"/g, (attribute, name, paint) =>
            DRAWN_WHITE.test(paint) ? `${name}="currentColor"` : attribute,
          ),
    )
    .join('');
}

function toJsx(body: string) {
  return body
    .replace(/ style="([^"]*)"/g, (_, css: string) => {
      const entries = css
        .split(';')
        .map(rule => rule.split(':').map(part => part.trim()))
        .filter(([property, value]) => property && value)
        .map(([property, value]) => `${camelCase(property)}: '${value}'`);
      return ` style={{ ${entries.join(', ')} }}`;
    })
    .replace(/ xmlns(?::\w+)?="[^"]*"/g, '')
    .replace(/ xlink:href=/g, ' href=')
    .replace(/ ([a-z]+(?:-[a-z]+)+)=/g, (_, name) => ` ${camelCase(name)}=`);
}

/**
 * Turns one Figma SVG export into the JSX source of its drawing.
 * @param source - the SVG file, as Figma exports it
 * @param name - the icon's code name, used to prefix ids (`Edit`, `Edit.small`)
 * @param options.fixed - keep every colour as drawn (illustrations)
 */
export function transformSvg(source: string, name: string, { fixed = false } = {}) {
  const root = /<svg\b([^>]*)>/.exec(source);
  const viewBox = root && /\bviewBox="([^"]+)"/.exec(root[1])?.[1];
  if (!root || !viewBox) throw new Error(`${name}: no <svg viewBox> root`);
  const fill = /\bfill="([^"]+)"/.exec(root[1])?.[1];
  const end = source.lastIndexOf('</svg>');
  let body = source
    .slice(root.index + root[0].length, end)
    .trim()
    .replace(/>\s+</g, '><');
  body = prefixIds(body, name.replace(/\W/g, '-'));
  if (!fixed) body = paintCurrentColor(body);
  body = toJsx(body);
  return { viewBox, jsx: fill ? `<g fill="${fill}">${body}</g>` : `<>${body}</>` };
}
