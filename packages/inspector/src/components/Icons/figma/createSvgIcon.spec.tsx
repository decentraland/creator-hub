import React, { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createSvgIcon } from './createSvgIcon';

const Twin = createSvgIcon(<path d="M0 0H24" />, 'Twin', {
  path: <path d="M4 4H20" />,
  viewBox: '4 4 16 16',
});
const SixteenTwin = createSvgIcon(<path d="M0 0H24" />, 'SixteenTwin', {
  path: <path d="M0 0H16" />,
  viewBox: '0 0 16 16',
});
const Single = createSvgIcon(<path d="M0 0H24" />, 'Single');

const svgOf = (ui: React.ReactElement) => render(ui).container.querySelector('svg')!;

describe('createSvgIcon', () => {
  describe('when sizing the box', () => {
    it.each([
      ['small', 'SvgIcon--fontSizeSmall'],
      ['medium', 'SvgIcon--fontSizeMedium'],
      ['inherit', 'SvgIcon--fontSizeInherit'],
    ] as const)('should give fontSize %s the %s class', (fontSize, className) => {
      const svg = svgOf(<Single fontSize={fontSize} />);
      expect(svg.classList).toContain('SvgIcon');
      expect(svg.classList).toContain(className);
    });

    it('should default to the medium box', () => {
      expect(svgOf(<Single />).classList).toContain('SvgIcon--fontSizeMedium');
    });

    it('should set no inline size', () => {
      expect(svgOf(<Single fontSize="small" />).getAttribute('style')).toBeNull();
    });

    it("should keep the caller's className and style", () => {
      const svg = svgOf(
        <Twin
          fontSize="small"
          className="consumer-box"
          style={{ fontSize: 12 }}
        />,
      );
      expect(svg.classList).toContain('consumer-box');
      expect(svg.style.fontSize).toBe('12px');
    });
  });

  describe('when choosing the drawing', () => {
    it('should render the small drawing only for fontSize small', () => {
      expect(svgOf(<Twin fontSize="small" />).innerHTML).toBe('<path d="M4 4H20"></path>');
      expect(svgOf(<Twin fontSize="medium" />).innerHTML).toBe('<path d="M0 0H24"></path>');
      expect(svgOf(<Twin fontSize="inherit" />).innerHTML).toBe('<path d="M0 0H24"></path>');
    });

    it('should render the base drawing at every size when there is no small drawing', () => {
      for (const fontSize of ['small', 'medium', 'inherit'] as const) {
        expect(svgOf(<Single fontSize={fontSize} />).innerHTML).toBe('<path d="M0 0H24"></path>');
      }
    });
  });

  describe('when setting the viewBox', () => {
    it('should frame the base drawing at 0 0 24 24', () => {
      expect(svgOf(<Twin />).getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('should crop a compact twin drawn in a 24 frame at 4 4 16 16', () => {
      expect(svgOf(<Twin fontSize="small" />).getAttribute('viewBox')).toBe('4 4 16 16');
    });

    it('should frame a 16-frame small drawing at 0 0 16 16', () => {
      expect(svgOf(<SixteenTwin fontSize="small" />).getAttribute('viewBox')).toBe('0 0 16 16');
    });

    it("should let the caller's viewBox win", () => {
      expect(svgOf(<Twin viewBox="1 2 3 4" />).getAttribute('viewBox')).toBe('1 2 3 4');
    });
  });

  describe('when colouring', () => {
    it('should fill with currentColor and add no colour class by default', () => {
      const svg = svgOf(<Single />);
      expect(svg.getAttribute('fill')).toBe('currentColor');
      expect(svg.getAttribute('class')).not.toContain('--color');
    });

    it.each([
      ['primary', 'SvgIcon--colorPrimary'],
      ['action', 'SvgIcon--colorAction'],
      ['disabled', 'SvgIcon--colorDisabled'],
    ] as const)('should give color %s the %s class', (color, className) => {
      expect(svgOf(<Single color={color} />).classList).toContain(className);
    });

    it('should apply htmlColor inline, where it beats a colour role', () => {
      const svg = svgOf(
        <Single
          color="primary"
          htmlColor="#123456"
        />,
      );
      expect(svg.style.color).toBe('#123456');
    });
  });

  describe('when exposing it to assistive tech', () => {
    it('should hide an unnamed icon', () => {
      const svg = svgOf(<Single />);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('role')).toBeNull();
    });

    it('should name an icon with titleAccess', () => {
      const svg = svgOf(<Single titleAccess="Edit" />);
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-hidden')).toBeNull();
      expect(svg.querySelector('title')?.textContent).toBe('Edit');
    });

    it('should forward the ref to the svg', () => {
      const ref = createRef<SVGSVGElement>();
      render(<Single ref={ref} />);
      expect(ref.current?.tagName.toLowerCase()).toBe('svg');
    });
  });

  describe('when the drawing reaches past its frame', () => {
    it('should let the 24 drawing overflow and keep the small drawing clipped', () => {
      expect(svgOf(<Twin />).getAttribute('overflow')).toBe('visible');
      expect(svgOf(<Twin fontSize="small" />).getAttribute('overflow')).toBeNull();
    });
  });

  it('should name the component after the icon', () => {
    expect((Single as unknown as { type: { displayName: string } }).type.displayName).toBe(
      'SingleIcon',
    );
  });
});
