import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
/* Шрифты лежат в самом сайте (пакеты @fontsource, лицензия OFL), а не
   грузятся с Google Fonts: страница не зависит от чужого сервера и его
   доступности, не делает лишних запросов при каждом заходе, а кириллица
   гарантированно та же, что проверялась в разработке. Каждый файл объявлен
   с unicode-range, поэтому браузер скачивает только нужные наборы символов
   (кириллица и латиница), а не все начертания подряд. */
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import '@fontsource/pt-serif/400-italic.css';
import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/700.css';
import '@fontsource/pt-sans/400-italic.css';
import '@fontsource/pt-mono/400.css';
import '@fontsource/fragment-mono/400.css';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
