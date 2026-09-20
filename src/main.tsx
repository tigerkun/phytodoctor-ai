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

// Register Service Worker
if ('serviceWorker' in navigator) {
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
