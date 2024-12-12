import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ImageEditor from './components/ImageEditor.tsx';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ImageEditor />
  </React.StrictMode>
);
