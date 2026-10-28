import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from '.';

describe('when a Button renders with no props', () => {
  it('should spell out the MUI defaults as deltas from the CSS baseline', () => {
    render(<Button>Go</Button>);

    expect(screen.getByRole('button').className).toBe('Button text primary medium');
  });

  it('should leave the native type attribute unset', () => {
    render(<Button>Go</Button>);

    expect(screen.getByRole('button').hasAttribute('type')).toBe(false);
  });
});

describe('when a Button takes the CSS baseline values', () => {
  it('should emit only the Button class', () => {
    render(
      <Button
        variant="contained"
        color="secondary"
        size="small"
      >
        Go
      </Button>,
    );

    expect(screen.getByRole('button').className).toBe('Button');
  });
});

describe('when a Button takes a variant', () => {
  it.each(['outlined', 'text'] as const)('should emit the %s class', variant => {
    render(
      <Button
        variant={variant}
        color="secondary"
        size="small"
      >
        Go
      </Button>,
    );

    expect(screen.getByRole('button').className).toBe(`Button ${variant}`);
  });
});

describe('when a Button takes a color', () => {
  it.each(['primary', 'info'] as const)('should emit the %s class', color => {
    render(
      <Button
        variant="contained"
        color={color}
        size="small"
      >
        Go
      </Button>,
    );

    expect(screen.getByRole('button').className).toBe(`Button ${color}`);
  });
});

describe('when a Button takes a size', () => {
  it.each(['medium', 'large'] as const)('should emit the %s class', size => {
    render(
      <Button
        variant="contained"
        color="secondary"
        size={size}
      >
        Go
      </Button>,
    );

    expect(screen.getByRole('button').className).toBe(`Button ${size}`);
  });
});

describe('when a Button takes a native type', () => {
  it('should pass it to the button element', () => {
    render(<Button type="submit">Go</Button>);

    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
});

describe('when a Button takes a className', () => {
  it('should merge it after the axis classes', () => {
    render(
      <Button
        variant="outlined"
        color="info"
        size="large"
        className="extra"
      >
        Go
      </Button>,
    );

    expect(screen.getByRole('button').className).toBe('Button outlined info large extra');
  });
});

describe('when a secondary text Button is a disabled link', () => {
  it('should emit text and link and carry the disabled attribute', () => {
    render(
      <Button
        variant="text"
        color="secondary"
        size="small"
        className="link"
        disabled
      >
        Go
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button.className).toBe('Button text link');
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
