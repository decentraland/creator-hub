import React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { getKeys } from '/@/modules/store/translation/utils';
import type { ChartSeries } from '/@/modules/store/metrics';
import { Chart } from './component';

const RUBY: ChartSeries = {
  key: 'd7',
  label: 'Day 7 Retention',
  color: 'var(--primary)',
  points: [
    { date: '2026-07-15', value: 30 },
    { date: '2026-07-16', value: 35 },
    { date: '2026-07-21', value: 41 },
  ],
};

const MESSAGES: ChartSeries = {
  key: 'messages',
  label: 'Messages Sent',
  color: '#2196F3',
  points: [
    { date: '2026-07-15', value: 400 },
    { date: '2026-07-16', value: 600 },
    { date: '2026-07-21', value: 900 },
  ],
};

const EMOTES: ChartSeries = {
  key: 'emotes',
  label: 'Emotes Played',
  color: '#34CE77',
  points: [
    { date: '2026-07-15', value: 1400 },
    { date: '2026-07-16', value: 1300 },
    { date: '2026-07-21', value: 1500 },
  ],
};

describe('Chart', () => {
  beforeAll(() => {
    getKeys('en');
  });

  describe('when rendering a single ruby series with an area wash', () => {
    it('should draw the line, the area and the pinned percent axis', () => {
      const { container } = render(
        <Chart
          series={[RUBY]}
          ariaLabel="Day 7 Retention"
          unit="%"
          yMax={80}
          yStep={20}
          area
        />,
      );
      expect(container.querySelectorAll('.series-line')).toHaveLength(1);
      expect(container.querySelector('.series-area')).not.toBeNull();
      expect(container.querySelectorAll('.grid-line')).toHaveLength(5);
      const axis = [...container.querySelectorAll('.axis-text')].map($ => $.textContent);
      expect(axis).toContain('80%');
    });
  });

  describe('when a series is fully masked', () => {
    it('should draw no line', () => {
      const masked: ChartSeries = {
        key: 'd1',
        label: 'Day 1 Retention',
        color: 'var(--primary)',
        points: RUBY.points.map(point => ({ ...point, value: null })),
      };
      const { container } = render(
        <Chart
          series={[masked]}
          ariaLabel="Day 1 Retention"
          unit="%"
          yMax={80}
        />,
      );
      expect(container.querySelectorAll('.series-line')).toHaveLength(0);
    });
  });

  describe('when rendering multiple count series with a legend', () => {
    it('should draw a line per series and a legend chip per series', () => {
      const { container, getByText } = render(
        <Chart
          series={[MESSAGES, EMOTES]}
          ariaLabel="Social Interactions"
          legend
        />,
      );
      expect(container.querySelectorAll('.series-line')).toHaveLength(2);
      expect(container.querySelectorAll('.legend-chip')).toHaveLength(2);
      expect(getByText('Messages Sent')).toBeDefined();
      expect(getByText('Emotes Played')).toBeDefined();
    });
  });

  describe('when navigating with the keyboard on a delta chart', () => {
    it('should show the date header and the series value with a signed delta', () => {
      const { container } = render(
        <Chart
          series={[RUBY]}
          ariaLabel="Day 7 Retention"
          unit="%"
          yMax={80}
          showDelta
        />,
      );
      const svg = container.querySelector('svg')!;
      fireEvent.keyDown(svg, { key: 'ArrowRight' });
      expect(container.querySelector('.tooltip-value')?.textContent).toBe('Jul 21');
      const line = container.querySelector('.tooltip-text')?.textContent;
      expect(line).toContain('Day 7 Retention 41%');
      expect(line).toContain('+6%');
      fireEvent.keyDown(svg, { key: 'Escape' });
      expect(container.querySelector('.tooltip-value')).toBeNull();
    });
  });

  describe('when there are no points', () => {
    it('should render nothing to hover', () => {
      const { container } = render(
        <Chart
          series={[{ key: 'x', label: 'X', color: 'var(--primary)', points: [] }]}
          ariaLabel="Empty"
        />,
      );
      expect(container.querySelector('.series-line')).toBeNull();
    });
  });
});
