import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadData } from './data';
import { App } from './App';
import './style.css';

const root = createRoot(document.getElementById('root')!);
loadData().then(
  () => root.render(<StrictMode><App /></StrictMode>),
  (e: Error) => root.render(<p className="loading">Could not load the data files ({e.message}). Use npm run dev or npm run preview; opening index.html directly will not work.</p>)
);
