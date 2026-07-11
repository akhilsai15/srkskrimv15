import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import {
  RetentionSettings,
  RetentionCategory,
  RetentionDurationDays,
  DEFAULT_RETENTION_SETTINGS,
  loadRetentionSettings,
  saveRetentionSettings,
  isRetentionOnboarded,
  markRetentionOnboarded,
  runRetentionSweep,
} from '../lib/dataRetention';

interface RetentionState {
  settings: RetentionSettings;
  onboarded: boolean;
  isSweeping: boolean;
  lastSweptAt: number | null;
  setCategoryDuration: (category: RetentionCategory, duration: RetentionDurationDays) => Promise<void>;
  setAllDurations: (settings: RetentionSettings) => Promise<void>;
  completeOnboarding: (settings: RetentionSettings) => Promise<void>;
  sweep: () => Promise<void>;
}

export const useRetentionStore = create<RetentionState>((set, get) => ({
  settings: loadRetentionSettings(),
  onboarded: isRetentionOnboarded(),
  isSweeping: false,
  lastSweptAt: null,

  setCategoryDuration: async (category, duration) => {
    const next = { ...get().settings, [category]: duration };
    try {
      await apiClient.put('/retention-settings', next);
    } catch (err) {
      console.warn("Failed to save retention settings to backend via PUT /retention-settings", err);
    }
    saveRetentionSettings(next);
    set({ settings: next });
    // Changing a value only affects *future* expiry checks — no retroactive
    // restore/delete happens here, just persist the new configuration.
  },

  setAllDurations: async (settings) => {
    try {
      await apiClient.put('/retention-settings', settings);
    } catch (err) {
      console.warn("Failed to save retention settings to backend via PUT /retention-settings", err);
    }
    saveRetentionSettings(settings);
    set({ settings });
  },

  completeOnboarding: async (settings) => {
    try {
      await apiClient.put('/retention-settings', settings);
    } catch (err) {
      console.warn("Failed to save retention settings to backend via PUT /retention-settings", err);
    }
    saveRetentionSettings(settings);
    markRetentionOnboarded();
    set({ settings, onboarded: true });
  },

  sweep: async () => {
    if (get().isSweeping) return;
    set({ isSweeping: true });
    try {
      const result = await runRetentionSweep(get().settings);
      set({ lastSweptAt: result.ranAt });
    } finally {
      set({ isSweeping: false });
    }
  },
}));

export type { RetentionSettings, RetentionCategory, RetentionDurationDays };
export { DEFAULT_RETENTION_SETTINGS };
