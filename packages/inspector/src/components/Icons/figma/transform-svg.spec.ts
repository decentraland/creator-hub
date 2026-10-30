import { describe, expect, it } from 'vitest';
import { transformSvg } from './transform-svg';

const svg = (body: string, viewBox = '0 0 24 24') =>
  `<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="24" height="24" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>\n`;

describe('transformSvg', () => {
  describe('when reading the root', () => {
    it('should return the root viewBox and drop the svg wrapper', () => {
      const { viewBox, jsx } = transformSvg(svg('<path d="M0 0" fill="white"/>', '0 0 16 16'), 'A');
      expect(viewBox).toBe('0 0 16 16');
      expect(jsx).not.toContain('<svg');
      expect(jsx).not.toContain('preserveAspectRatio');
      expect(jsx).not.toContain('display');
    });

    it("should keep the root's fill on a wrapping group so stroke-only paths stay unfilled", () => {
      const { jsx } = transformSvg(svg('<path d="M0 0" stroke="white"/>'), 'A');
      expect(jsx).toMatch(/^<g fill="none">/);
    });
  });

  describe('when rewriting paints', () => {
    it.each(['white', '#FFFFFF', '#ffffff', '#fff', '#FCFCFC', '#fcfcfc'])(
      'should turn fill and stroke %s into currentColor',
      paint => {
        const { jsx } = transformSvg(
          svg(`<path d="M0 0" fill="${paint}" stroke="${paint}"/>`),
          'A',
        );
        expect(jsx).toContain('fill="currentColor" stroke="currentColor"');
      },
    );

    it('should keep any other colour as drawn', () => {
      const { jsx } = transformSvg(svg('<path d="M0 0" fill="#FF2D55"/>'), 'A');
      expect(jsx).toContain('fill="#FF2D55"');
    });

    it('should keep fill none', () => {
      const { jsx } = transformSvg(svg('<path d="M0 0" fill="none" stroke="white"/>'), 'A');
      expect(jsx).toContain('<path d="M0 0" fill="none" stroke="currentColor"/>');
    });

    it('should never rewrite paints inside a mask', () => {
      const { jsx } = transformSvg(
        svg(
          '<mask id="m"><rect fill="white"/><path fill="black"/></mask><g mask="url(#m)"><path fill="white"/></g>',
        ),
        'A',
      );
      expect(jsx).toContain('<rect fill="white"/><path fill="black"/></mask>');
      expect(jsx).toContain('<path fill="currentColor"/>');
    });

    it('should leave a fixed icon entirely as drawn', () => {
      const { jsx } = transformSvg(svg('<path fill="white" stroke="#FCFCFC"/>'), 'A', {
        fixed: true,
      });
      expect(jsx).toContain('<path fill="white" stroke="#FCFCFC"/>');
    });
  });

  describe('when prefixing ids', () => {
    const body =
      '<g clip-path="url(#clip0_1)"><path fill="url(#paint0)"/><use href="#clip0_1"/></g><defs><clipPath id="clip0_1"><rect/></clipPath><linearGradient id="paint0"/></defs>';

    it('should prefix every referenced id and every reference with the icon name', () => {
      const { jsx } = transformSvg(svg(body), 'Magnet.small');
      expect(jsx).toContain('id="Magnet-small-clip0_1"');
      expect(jsx).toContain('id="Magnet-small-paint0"');
      expect(jsx).toContain('clipPath="url(#Magnet-small-clip0_1)"');
      expect(jsx).toContain('fill="url(#Magnet-small-paint0)"');
      expect(jsx).toContain('href="#Magnet-small-clip0_1"');
    });

    it('should make the same Figma id distinct across two icons', () => {
      const a = transformSvg(svg(body), 'HidePreview').jsx;
      const b = transformSvg(svg(body), 'ShowPreview').jsx;
      expect(a).toContain('id="HidePreview-clip0_1"');
      expect(b).toContain('id="ShowPreview-clip0_1"');
    });

    it('should drop layer-name ids nothing references', () => {
      const { jsx } = transformSvg(svg('<g id="Ellipse 1358"><path id="Vector"/></g>'), 'A');
      expect(jsx).not.toContain('id=');
    });
  });

  describe('when converting attributes to JSX', () => {
    it('should camel-case hyphenated attribute names', () => {
      const { jsx } = transformSvg(
        svg(
          '<path fill-rule="evenodd" clip-rule="evenodd" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stop-color="red" color-interpolation-filters="sRGB"/>',
        ),
        'A',
      );
      expect(jsx).toContain(
        'fillRule="evenodd" clipRule="evenodd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" stopColor="red" colorInterpolationFilters="sRGB"',
      );
    });

    it('should turn xlink:href into href', () => {
      const { jsx } = transformSvg(svg('<use xlink:href="#a"/><path id="a"/>'), 'A');
      expect(jsx).toContain('<use href="#A-a"/>');
    });

    it('should turn a style string into a style object', () => {
      const { jsx } = transformSvg(
        svg('<mask style="mask-type:alpha"/><g style="mix-blend-mode:overlay"/>'),
        'A',
        { fixed: true },
      );
      expect(jsx).toContain("<mask style={{ maskType: 'alpha' }}/>");
      expect(jsx).toContain("<g style={{ mixBlendMode: 'overlay' }}/>");
    });
  });
});
