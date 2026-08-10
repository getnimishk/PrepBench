import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register Chart.js defaults globally
import { Chart, defaults } from 'chart.js';
defaults.font.family = "'Inter', sans-serif";
defaults.color = '#9CA3AF';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
