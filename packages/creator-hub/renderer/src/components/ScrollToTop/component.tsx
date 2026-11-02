import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// MemoryRouter has no scroll restoration, so the document offset of the page you
// leave carries into the page you open (#1491). Reset it whenever the path changes.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
