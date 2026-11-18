import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ThemeLangInit from './components/ThemeLangInit';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeLangInit />
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'text-sm',
          style: { maxWidth: '90vw' },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
