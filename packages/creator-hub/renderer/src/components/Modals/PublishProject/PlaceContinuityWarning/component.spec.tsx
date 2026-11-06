import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { PlaceContinuityWarning } from './component';

function renderWarning(props: Parameters<typeof PlaceContinuityWarning>[0]) {
  return render(
    <ThemeProvider theme={dark}>
      <PlaceContinuityWarning {...props} />
    </ThemeProvider>,
  );
}

describe('PlaceContinuityWarning', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
  });

  it('announces itself to assistive technology', () => {
    renderWarning({ kind: 'land' });
    expect(screen.getByRole('alert').textContent).toContain(
      'Your scene will lose its Places listing',
    );
  });

  it('explains the Genesis City rule', () => {
    renderWarning({ kind: 'land' });
    expect(screen.getByRole('alert').textContent).toContain('keeps neither its base parcel');
    expect(screen.getByRole('alert').textContent).toContain('publish to the same base parcel');
  });

  it('names how many scenes a world merge overlaps', () => {
    renderWarning({ kind: 'world-merge', overlap: 3 });
    expect(screen.getByRole('alert').textContent).toContain('overlaps 3 existing scenes');
    expect(screen.getByRole('alert').textContent).toContain('replaces exactly one existing scene');
  });

  it('explains that single-scene mode empties the world', () => {
    renderWarning({ kind: 'world-replace' });
    expect(screen.getByRole('alert').textContent).toContain('removes every scene from this World');
    expect(screen.getByRole('alert').textContent).toContain('turn on multiple scenes');
  });
});
