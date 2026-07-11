import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

const ONLINE_TIMEOUT = 5 * 60 * 1000;

export function initOnlineTracking() {
  if (typeof window === 'undefined') return;

  const updateLastActive = async () => {
    localStorage.setItem('skrimchat_last_active', Date.now().toString());
    window.dispatchEvent(new Event('skrimchat_online_status'));
    try {
      await apiClient.post('/skrimchat-presence/active', { active: true });
    } catch (e) {
      console.warn("Failed to update active presence via apiClient", e);
    }
  };

  document.addEventListener('click', updateLastActive);
  document.addEventListener('scroll', updateLastActive, { passive: true });
  document.addEventListener('keypress', updateLastActive);
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      window.dispatchEvent(new Event('skrimchat_online_status'));
      try {
        await apiClient.post('/skrimchat-presence/active', { active: false });
      } catch (e) {}
    } else {
      updateLastActive();
    }
  });

  // initial ping
  updateLastActive();

  setInterval(() => {
    window.dispatchEvent(new Event('skrimchat_online_status'));
  }, 60000);
}

export function initMockUsersOnlineToggle() {
  if (typeof window === 'undefined') return;
  setInterval(() => {
    const statusesStr = localStorage.getItem('skrimchat_mock_online_statuses');
    if (statusesStr) {
      const statuses: Record<string, boolean> = JSON.parse(statusesStr);
      let changed = false;
      Object.keys(statuses).forEach(key => {
        if (Math.random() < 0.2) {
          statuses[key] = !statuses[key];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('skrimchat_mock_online_statuses', JSON.stringify(statuses));
        window.dispatchEvent(new Event('skrimchat_mock_online_updated'));
      }
    }
  }, 5 * 60 * 1000);
}

export function useIsOnline(username?: string) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!username) return;

    const normUser = username.replace('@', '').toLowerCase();

    const fetchStatus = async () => {
      try {
        const res = await apiClient.get<{ isOnline: boolean }>(`/skrimchat-presence/${normUser}`);
        setIsOnline(res.isOnline);
      } catch (err) {
        console.warn(`Failed to fetch presence for ${normUser} via apiClient, using local fallback.`, err);
        // Fallback for offline mode or mock compatibility
        const lastActive = parseInt(localStorage.getItem('skrimchat_last_active') || '0', 10);
        const now = Date.now();
        setIsOnline(now - lastActive < ONLINE_TIMEOUT);
      }
    };

    fetchStatus();

    // Poll every 30s to keep it fresh
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, [username]);

  return isOnline;
}
