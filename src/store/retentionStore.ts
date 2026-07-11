import { create } from 'zustand';
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
  setCategoryDuration: (category: RetentionCategory, duration: RetentionDurationDays) => void;
  setAllDurations: (settings: RetentionSettings) => void;
  completeOnboarding: (settings: RetentionSettings) => void;
  sweep: () => Promise<void>;
}

export const useRetentionStore = create<RetentionState>((set, get) => ({
  settings: loadRetentionSettings(),
  onboarded: isRetentionOnboarded(),
  isSweeping: false,
  lastSweptAt: null,

  setCategoryDuration: (category, duration) => {
    const next = { ...get().settings, [category]: duration };
    saveRetentionSettings(next);
    set({ settings: next });
    // Changing a value only affects *future* expiry checks — no retroactive
    // restore/delete happens here, just persist the new configuration.
  },

  setAllDurations: (settings) => {
    saveRetentionSettings(settings);
    set({ settings });
  },

  completeOnboarding: (settings) => {
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
