import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Accordion } from '.';

const getRegion = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[role="region"]')!;

describe('when the accordion renders open by default', () => {
  it('should expose the header as a native button named after the label', () => {
    render(<Accordion label="Video Screens">body</Accordion>);

    const button = screen.getByRole('button', { name: 'Video Screens' });

    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('should expose the content as a region named after the label and controlled by the button', () => {
    render(<Accordion label="Video Screens">body</Accordion>);

    const button = screen.getByRole('button', { name: 'Video Screens' });
    const region = screen.getByRole('region', { name: 'Video Screens' });

    expect(region.id).toBeTruthy();
    expect(button.getAttribute('aria-controls')).toBe(region.id);
  });
});

describe('when the header is activated', () => {
  it('should collapse the region and unmount its children, then expand them again', () => {
    const { container } = render(
      <Accordion label="Video Screens">
        <span data-testid="child">body</span>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Video Screens' });

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(getRegion(container).hidden).toBe(true);
    expect(screen.queryByTestId('child')).toBeNull();

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(getRegion(container).hidden).toBe(false);
    expect(screen.queryByTestId('child')).not.toBeNull();
  });
});

describe('when enabled is given', () => {
  it('should render an enable checkbox named after the label, outside the button', () => {
    render(
      <Accordion
        label="Video Screens"
        enabled
      >
        body
      </Accordion>,
    );

    const button = screen.getByRole('button', { name: 'Video Screens' });
    const checkbox = screen.getByRole('checkbox', { name: 'Enable Video Screens' });

    expect(button.contains(checkbox)).toBe(false);
  });

  it('should report the new value without toggling the section', () => {
    const onToggleEnabled = vi.fn();
    render(
      <Accordion
        label="Video Screens"
        enabled
        onToggleEnabled={onToggleEnabled}
      >
        body
      </Accordion>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Video Screens' }));

    expect(onToggleEnabled).toHaveBeenCalledWith(false);
    expect(
      screen.getByRole('button', { name: 'Video Screens' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});

describe('when enabled is false on mount', () => {
  it('should render the checkbox unchecked', () => {
    render(
      <Accordion
        label="Video Screens"
        enabled={false}
      >
        body
      </Accordion>,
    );

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Enable Video Screens',
    });

    expect(checkbox.checked).toBe(false);
  });
});

describe('when enabled changes from the parent', () => {
  it('should follow it, hide the region while off and remember the open state', () => {
    const { container, rerender } = render(
      <Accordion
        label="Video Screens"
        enabled
      >
        body
      </Accordion>,
    );
    const checkbox = () =>
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Enable Video Screens' });
    const button = screen.getByRole('button', { name: 'Video Screens' });

    expect(checkbox().checked).toBe(true);

    rerender(
      <Accordion
        label="Video Screens"
        enabled={false}
      >
        body
      </Accordion>,
    );

    expect(checkbox().checked).toBe(false);
    expect(container.firstElementChild!.classList.contains('disabled')).toBe(true);
    expect(getRegion(container).hidden).toBe(true);

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('false');

    rerender(
      <Accordion
        label="Video Screens"
        enabled
      >
        body
      </Accordion>,
    );

    expect(getRegion(container).hidden).toBe(true);

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(getRegion(container).hidden).toBe(false);
  });
});

describe('when enabled is omitted', () => {
  it('should render no checkbox and no has-toggle class', () => {
    const { container } = render(<Accordion label="Video Screens">body</Accordion>);

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(container.firstElementChild!.classList.contains('has-toggle')).toBe(false);
  });
});

describe('when the chevron renders', () => {
  it('should hide the glyph from assistive tech and leave the label as the button name', () => {
    const { container } = render(<Accordion label="Video Screens">body</Accordion>);

    const button = screen.getByRole('button', { name: 'Video Screens' });

    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(button.textContent).toBe('Video Screens');
  });
});

describe('when tabbing through the header', () => {
  it('should reach the button before the checkbox with no positive tabindex', () => {
    const { container } = render(
      <Accordion
        label="Video Screens"
        enabled
      >
        body
      </Accordion>,
    );

    const button = screen.getByRole('button', { name: 'Video Screens' });
    const checkbox = screen.getByRole('checkbox', { name: 'Enable Video Screens' });

    expect(
      button.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll<HTMLElement>('*')).filter(el => el.tabIndex > 0),
    ).toHaveLength(0);
  });
});
