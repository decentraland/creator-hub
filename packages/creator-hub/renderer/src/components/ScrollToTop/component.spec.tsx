import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScrollToTop } from '.';

function Page({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go</button>;
}

describe('ScrollToTop', () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as typeof window.scrollTo;
    render(
      <MemoryRouter initialEntries={['/home']}>
        <ScrollToTop />
        <Routes>
          <Route
            path="/home"
            element={<Page to="/templates" />}
          />
          <Route
            path="/templates"
            element={<Page to="/templates" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    scrollTo.mockClear();
  });

  afterEach(cleanup);

  describe('when navigating to another path', () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole('button', { name: 'go' }));
    });

    it('should scroll the document back to the top', () => {
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('when navigating to the same path', () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole('button', { name: 'go' }));
      scrollTo.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'go' }));
    });

    it('should leave the scroll position alone', () => {
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
