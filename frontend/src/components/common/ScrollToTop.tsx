// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A new screen opens at its top.
 *
 * The browser keeps the window's scroll position when the router swaps one page for another, so
 * "Next chapter" at the foot of a long chapter opened the next one already scrolled to its foot.
 * This resets the scroll whenever the path changes. It leaves alone a change of query string or
 * tab (the same screen), and a link with a #hash, which names its own target.
 */
export const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      // Not every environment implements scrolling (jsdom does not); there is nothing to reset there.
    }
  }, [pathname, hash]);

  return null;
};
