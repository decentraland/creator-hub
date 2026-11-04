import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { TimeSeriesPoint } from '/shared/types/place-analytics';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { TimeSeriesChart } from './TimeSeriesChart';

const CAPTION = en.analytics.detail.retention.day_7_cohort.settling.caption;

const week = (day: number, value: number, settling?: boolean): TimeSeriesPoint => ({
  date: new Date(2026, 9, day).getTime(),
  value,
  settling,
});

const renderChart = (points: TimeSeriesPoint[]) =>
  render(
    <TimeSeriesChart
      points={points}
      seriesName="Day 7 Retention"
      formatValue={value => `${value}%`}
    />,
  );

describe('TimeSeriesChart', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when some cohorts are still settling', () => {
    it('should explain the dotted line under the plot', () => {
      renderChart([week(5, 12, false), week(12, 9, false), week(19, 4, true), week(26, 0, true)]);

      expect(screen.getByText(CAPTION)).toBeTruthy();
    });
  });

  describe('when every cohort is final', () => {
    it('should not show the settling caption', () => {
      renderChart([week(5, 12, false), week(12, 9, false), week(19, 11, false)]);

      expect(screen.queryByText(CAPTION)).toBeNull();
    });
  });

  describe('when the series carries no settling flag at all', () => {
    it('should not show the settling caption', () => {
      renderChart([week(5, 12), week(12, 9)]);

      expect(screen.queryByText(CAPTION)).toBeNull();
    });
  });
});
