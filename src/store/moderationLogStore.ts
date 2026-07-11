/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

export interface ModerationLogEntry {
  id: string;
  surface: 'pulse' | 'vibe' | 'spark';
  mediaKind: 'image' | 'video';
  score: number;
  categories: string[];
  source: 'remote' | 'local_heuristic';
  userHandle?: string;
  createdAt: number;
}

const LOG_KEY = 'skrimchat_moderation_log';

function loadLog(): ModerationLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistLog(entries: ModerationLogEntry[]) {
  try {
    // Keep this bounded — it's an audit trail, not unbounded storage.
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch (e) {
    console.warn('Failed to persist moderation log', e);
  }
}

interface ModerationLogState {
  entries: ModerationLogEntry[];
  hydrate: () => Promise<void>;
  /**
   * Records an auto-block event. This is fired automatically by the
   * moderation gate the instant flagged media is rejected — it's a
   * read-only audit record for the SkrimChat team, not an approval gate.
   * The content is already blocked by the time this is called.
   */
  logAutoBlock: (entry: Omit<ModerationLogEntry, 'id' | 'createdAt'>) => Promise<void>;
  clear: () => Promise<void>;
}

export const useModerationLogStore = create<ModerationLogState>((set, get) => ({
  entries: [],
  hydrate: async () => {
    try {
      const logs = await apiClient.get<ModerationLogEntry[]>('/skrimchat-moderation-logs');
      set({ entries: logs || [] });
    } catch (err) {
      console.warn("Failed to fetch moderation logs from apiClient, fallback locally.", err);
      set({ entries: loadLog() });
    }
  },
  logAutoBlock: async (entry) => {
    const newEntry: ModerationLogEntry = {
      ...entry,
      id: `modlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    try {
      await apiClient.post('/skrimchat-moderation-logs', newEntry);
    } catch (err) {
      console.warn("Failed to log auto block via apiClient, saving locally.", err);
    }
    const next = [newEntry, ...get().entries];
    set({ entries: next });
    persistLog(next);
  },
  clear: async () => {
    try {
      await apiClient.delete('/skrimchat-moderation-logs');
    } catch (err) {
      console.warn("Failed to clear moderation logs via apiClient.", err);
    }
    set({ entries: [] });
    persistLog([]);
  },
}));
