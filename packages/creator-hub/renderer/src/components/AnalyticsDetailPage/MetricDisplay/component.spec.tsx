import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HeroStat } from '../HeroStat';

import { MetricDisplay } from './component';

describe('MetricDisplay', () => {
  afterEach(cleanup);

  describe('when rendering a figure', () => {
    it('should show the value as text, not as a heading', () => {
      render(
        <MetricDisplay
          label="Total Visits"
          tooltip="Every visit to your place."
          value="355"
        />,
      );

      expect(screen.getByText('355')).toBeTruthy();
      expect(screen.queryByRole('heading')).toBeNull();
    });
  });
});

describe('HeroStat', () => {
  afterEach(cleanup);

  describe('when rendering a figure with its unit', () => {
    it('should show the value as text, not as a heading', () => {
      render(
        <HeroStat
          value="13"
          unit="min"
        />,
      );

      expect(screen.getByText('13')).toBeTruthy();
      expect(screen.queryByRole('heading')).toBeNull();
    });
  });
});
