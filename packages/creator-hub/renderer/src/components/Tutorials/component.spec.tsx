import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TutorialsWrapper } from '/@/components/Tutorials';

vi.mock('#store', () => ({ useDispatch: () => vi.fn() }));
vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string) => id,
}));

describe('TutorialsWrapper', () => {
  describe('when tutorials are disabled', () => {
    it('should hide the tutorials and expand its content', () => {
      const { container } = render(
        <TutorialsWrapper showTutorials={false}>
          <div>Scene content</div>
        </TutorialsWrapper>,
      );

      expect(container.querySelector('.Tutorials')).toBeNull();
      expect(container.querySelector('.TutorialsWrapper')?.classList.contains('full-width')).toBe(
        true,
      );
    });
  });

  describe('when showTutorials is not passed', () => {
    it('should show the tutorials beside its content', () => {
      const { container } = render(
        <TutorialsWrapper>
          <div>Scene content</div>
        </TutorialsWrapper>,
      );

      expect(container.querySelector('.Tutorials')).not.toBeNull();
      expect(container.querySelector('.TutorialsWrapper')?.classList.contains('full-width')).toBe(
        false,
      );
    });
  });
});
