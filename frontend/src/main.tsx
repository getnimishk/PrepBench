// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register Chart.js defaults globally
import { defaults } from 'chart.js';
defaults.font.family = "'Inter', sans-serif";
defaults.color = '#9CA3AF';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
