import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

import './index.css';

ReactDOM.createRoot(
  document.getElementById('root')!,
).render(
  <React.StrictMode>
    {/* App provides its own AuthProvider internally (see src/App.tsx). */}
    <App />
  </React.StrictMode>,
);