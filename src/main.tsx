import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { scheduleGrindReminder, showGrindSignal, checkGrindRisk, simulatePulseReward, simulateLanguageMatchSignal } from './store/signalStore';
import { loadConfig } from './lib/runtimeConfig';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // SW registered
      }).catch(err => {
        console.log('SW registration failed: ', err);
      });
      
      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'REMIND_LATER') {
          const now = new Date();
          const reminder9PM = new Date();
          reminder9PM.setHours(21, 0, 0, 0); // 9 PM
          if (now < reminder9PM) {
            const delay = reminder9PM.getTime() - now.getTime();
            setTimeout(() => {
              const { atRisk, grindCount } = checkGrindRisk();
              if (atRisk) {
                showGrindSignal(grindCount);
              }
            }, delay);
          }
        }
      });
    } catch (e) {
      console.warn('Service workers are blocked or not supported in this frame environment:', e);
    }
  });
}

// Initial grind schedule setup
scheduleGrindReminder();

// @ts-ignore
window.simulateGrindReminder = (count = 5) => showGrindSignal(count);
// @ts-ignore
window.simulatePulseReward = (event = 'milestone_20') => simulatePulseReward(event as any);
// @ts-ignore
window.simulateLanguageMatch = (langs = ['te', 'en'], count = 15, force = true) => simulateLanguageMatchSignal(langs, count, force);

const container = document.getElementById('root')!;
const root = createRoot(container);

// Render simple, elegant loading state first
root.render(
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: 'Inter, sans-serif',
    backgroundColor: '#0b0f19',
    color: '#e2e8f0'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #1e293b',
      borderTop: '4px solid #38bdf8',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 500 }}>Initializing application...</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Load runtime configuration before mounting App
loadConfig()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    root.render(
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#0b0f19',
        color: '#ef4444'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#f87171', marginBottom: '8px' }}>Initialization Failed</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '450px', lineHeight: '1.5' }}>
          {error instanceof Error ? error.message : 'An error occurred while loading the application configuration.'}
        </p>
      </div>
    );
  });
