import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedIfEmpty, runDbMigration } from './db/seed';
import { DayNightProvider } from './components/home/DayNightProvider';
import { GameService } from './services/gameService';

// Initialize DB with demo data & migration
runDbMigration().catch(console.error);

// Flush any pending seed-sync outbox entries when connectivity is restored
window.addEventListener('online', () => GameService.flushSeedSyncOutbox());

// Register Service Worker — production only. In dev, Vite serves unhashed
// modules that mutate on every save; the worker's runtime cache would hold
// stale module graphs and HMR would silently fight it, which reads as
// "changes not applying" rather than as a caching bug.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DayNightProvider>
      <App />
    </DayNightProvider>
  </StrictMode>,
);
