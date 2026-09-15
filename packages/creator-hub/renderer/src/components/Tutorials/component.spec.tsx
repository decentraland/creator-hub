import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TutorialsWrapper } from '/@/components/Tutorials';

describe('TutorialsWrapper', () => {
  it('hides tutorials and expands its content when tutorials are disabled', () => {
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
