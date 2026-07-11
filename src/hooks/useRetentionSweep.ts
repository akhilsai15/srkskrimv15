import { useEffect } from 'react';
import { useRetentionStore } from '../store/retentionStore';

// How often to re-check for expired items while the app stays open.
// Deletion itself is only ever driven by each category's configured
// retention duration — this just controls how promptly the sweep notices
// something has crossed that age.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Mount once near the app root (after auth) to keep the Data Retention
 *  engine running for the life of the session. */
export function useRetentionSweep(enabled: boolean) {
  const sweep = useRetentionStore(s => s.sweep);

  useEffect(() => {
    if (!enabled) return;
    sweep();
    const interval = setInterval(() => {
      sweep();
    }, SWEEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, sweep]);
}
