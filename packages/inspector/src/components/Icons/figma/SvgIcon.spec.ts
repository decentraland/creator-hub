import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(join(__dirname, 'SvgIcon.css'), 'utf8');

const RULES = new Map(
  Array.from(stylesheet.matchAll(/:where\(\.([\w-]+)\)\s*\{([^}]*)\}/g), ([, className, body]) => [
    className,
    body.trim().replace(/\s+/g, ' '),
  ]),
);

describe('SvgIcon.css', () => {
  it('should give every rule zero specificity, so a consumer class or the parent wins', () => {
    expect(RULES.size).toBeGreaterThan(0);
    expect(stylesheet.split('{').length - 1).toBe(RULES.size);
  });

  it.each([
    ['SvgIcon', 'width: 1em; height: 1em; flex-shrink: 0;'],
    ['SvgIcon--fontSizeSmall', 'font-size: 16px;'],
    ['SvgIcon--fontSizeMedium', 'font-size: 24px;'],
    ['SvgIcon--fontSizeInherit', 'font-size: inherit;'],
    ['SvgIcon--colorPrimary', 'color: var(--primary-main);'],
    ['SvgIcon--colorSecondary', 'color: var(--white);'],
    ['SvgIcon--colorError', 'color: var(--error-main);'],
    ['SvgIcon--colorWarning', 'color: var(--warning-main);'],
    ['SvgIcon--colorInfo', 'color: var(--palette-info-main);'],
    ['SvgIcon--colorSuccess', 'color: var(--success-main);'],
    ['SvgIcon--colorAction', 'color: var(--ui-designer-text-muted);'],
    ['SvgIcon--colorDisabled', 'color: var(--palette-whiteTransparent-soft);'],
  ])('should style .%s with %s', (className, declarations) => {
    expect(RULES.get(className)).toBe(declarations);
  });
});
