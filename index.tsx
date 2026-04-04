
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Catch and display any initialization errors on screen
window.addEventListener('unhandledrejection', (e) => {
  document.getElementById('root')!.innerHTML = `<pre style="color:red;padding:20px;font-size:14px">Unhandled Promise Rejection:\n${e.reason?.stack || e.reason}</pre>`;
});

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err: any) {
  rootElement.innerHTML = `<pre style="color:red;padding:20px;font-size:14px">Startup Error:\n${err.stack || err}</pre>`;
}
