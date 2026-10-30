import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Edit, Leave } from '.';

function renderSvg(ui: React.ReactElement) {
  const { container } = render(ui);
  return container.querySelector('svg')!;
}

describe('Creator Hub icon binding', () => {
  afterEach(cleanup);

  describe('when rendering an icon at the default size', () => {
    it('should render a MUI SvgIcon over the 24 drawing', () => {
      const svg = renderSvg(<Edit />);
      expect(svg.classList.contains('MuiSvgIcon-root')).toBe(true);
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('overflow')).toBe('visible');
    });
  });

  describe('when rendering an icon with fontSize small', () => {
    it('should render the small drawing at 16px, not MUI 20px', () => {
      const base = renderSvg(<Edit />).innerHTML;
      cleanup();
      const svg = renderSvg(<Edit fontSize="small" />);
      expect(svg.getAttribute('viewBox')).toBe('4 4 16 16');
      expect(svg.innerHTML).not.toBe(base);
      expect(svg.getAttribute('overflow')).toBeNull();
      expect(svg.classList.contains('MuiSvgIcon-fontSizeSmall')).toBe(true);
      expect(getComputedStyle(svg).fontSize).toBe('16px');
    });

    describe('and the call site sets its own sx fontSize', () => {
      it('should let the call site win', () => {
        const svg = renderSvg(
          <Edit
            fontSize="small"
            sx={{ fontSize: 12 }}
          />,
        );
        expect(getComputedStyle(svg).fontSize).toBe('12px');
      });
    });

    describe('and the icon has no small drawing', () => {
      it('should keep the 24 drawing', () => {
        const svg = renderSvg(<Leave fontSize="small" />);
        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
        expect(getComputedStyle(svg).fontSize).toBe('16px');
      });
    });
  });

  describe('when rendering an icon with a theme colour role', () => {
    it('should keep MUI colour class', () => {
      const svg = renderSvg(<Edit color="primary" />);
      expect(svg.classList.contains('MuiSvgIcon-colorPrimary')).toBe(true);
    });
  });

  describe('when rendering an icon with titleAccess', () => {
    it('should expose a title and drop aria-hidden', () => {
      const svg = renderSvg(<Edit titleAccess="Edit" />);
      expect(svg.querySelector('title')?.textContent).toBe('Edit');
      expect(svg.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  describe('when reading the component statics', () => {
    it('should carry MUI muiName', () => {
      expect((Edit as unknown as { muiName: string }).muiName).toBe('SvgIcon');
    });
  });
});
