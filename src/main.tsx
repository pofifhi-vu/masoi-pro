import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { InAppBrowserBlocker } from './components/InAppBrowserBlocker';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InAppBrowserBlocker>
      <App />
    </InAppBrowserBlocker>
  </React.StrictMode>
);
