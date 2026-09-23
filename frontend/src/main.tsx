// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { FONT_STACK } from './theme/tokens';

// Charts draw their text on a canvas, which takes a font by name and never
// waits for it. The family is the interface's own -- it used to ask for an
// Inter the page never loaded, so every chart label fell back to Arial -- and
// any chart drawn before the font arrived is drawn again once it has.
import { Chart, defaults } from 'chart.js';
defaults.font.family = FONT_STACK;
defaults.color = '#5f625c';
if (typeof document !== 'undefined' && document.fonts?.ready) {
  void document.fonts.ready.then(() => {
    Object.values(Chart.instances).forEach((chart) => chart.update('none'));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
