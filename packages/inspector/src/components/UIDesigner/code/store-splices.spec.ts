import { describe, expect, it } from 'vitest';

import { widgetJsx } from './store-splices';

describe('widgetJsx fullscreen preset', () => {
  it('emits a fill x fill container: flexGrow + stretch, no width/height', () => {
    const jsx = widgetJsx('UiEntity', 'fullscreen', false);

    expect(jsx).toContain('flexGrow: 1');
    expect(jsx).toContain("alignSelf: 'stretch'");
    expect(jsx).not.toMatch(/\bwidth:/);
    expect(jsx).not.toMatch(/\bheight:/);
  });

  it('leaves the plain container fixed-size', () => {
    const jsx = widgetJsx('UiEntity', undefined, false);

    expect(jsx).toContain('width: 200');
    expect(jsx).toContain('height: 100');
  });
});
