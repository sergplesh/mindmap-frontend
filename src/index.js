import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Подавление ошибки ResizeObserver
if (typeof window !== 'undefined') {
  // Сохраняем оригинальный console.error
  const originalConsoleError = console.error;
  
  // Переопределяем console.error для фильтрации ошибок ResizeObserver
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && 
        (args[0].includes('ResizeObserver') || 
         args[0].includes('loop completed') ||
         args[0].includes('undelivered notifications'))) {
      return; // Игнорируем
    }
    originalConsoleError.apply(console, args);
  };

  // Также перехватываем глобальные ошибки
  window.addEventListener('error', (e) => {
    if (e.message && (
        e.message.includes('ResizeObserver') || 
        e.message.includes('loop completed') ||
        e.message.includes('undelivered notifications'))) {
      e.stopPropagation();
      e.preventDefault();
      return false;
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
