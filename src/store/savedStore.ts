import { create } from 'zustand';
import { markSavedAt, clearSavedAt } from '../lib/dataRetention';
import { apiClient } from '../lib/apiClient';

interface SavedState {
  savedPosts: string[];      // array of post IDs
  repostedPosts: string[];   // array of post IDs
  savedFullPosts: any[];     // full post objects for display in Identity
  hydrate: () => Promise<void>;
  savePost: (postId: string, postObj?: any) => Promise<void>;
  unsavePost: (postId: string) => Promise<void>;
}

const SAVED_KEY = 'skrimchat_saved_posts';
const SAVED_FULL_KEY = 'skrimchat_saved_posts_full';

export const useSavedStore = create<SavedState>((set, get) => ({
  savedPosts: [],
  repostedPosts: [],
  savedFullPosts: [],

  hydrate: async () => {
    try {
      const res = await apiClient.get<any>('/skrimchat-saved-items');
      set({
        savedPosts: res.savedPosts || [],
        savedFullPosts: res.savedFullPosts || [],
        repostedPosts: res.repostedPosts || [],
      });
    } catch (e) {
      console.warn("Failed to fetch saved items from apiClient, fallback locally", e);
      try {
        const ids: string[] = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
        const fullPosts: any[] = JSON.parse(localStorage.getItem(SAVED_FULL_KEY) || '[]');
        const reposts: any[] = JSON.parse(localStorage.getItem('skrimchat_reposts') || '[]');
        const repostIds = reposts.map((r: any) => r.originalPost?.id || r.id).filter(Boolean);
        set({ savedPosts: ids, savedFullPosts: fullPosts, repostedPosts: repostIds });
      } catch (err) {
        set({ savedPosts: [], savedFullPosts: [], repostedPosts: [] });
      }
    }
  },

  savePost: async (postId: string, postObj?: any) => {
    try {
      await apiClient.post('/skrimchat-saved-items/save', { postId, postObj });
    } catch (e) {
      console.warn("Failed to save post via apiClient, fallback locally", e);
    }
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      if (!ids.includes(postId)) {
        const updated = [postId, ...ids];
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
        markSavedAt(postId);

        if (postObj) {
          const full: any[] = JSON.parse(localStorage.getItem(SAVED_FULL_KEY) || '[]');
          if (!full.find((p: any) => p.id === postId)) {
            const updatedFull = [postObj, ...full];
            localStorage.setItem(SAVED_FULL_KEY, JSON.stringify(updatedFull));
          }
        }
      }
    } catch (e) {}
    await get().hydrate();
    window.dispatchEvent(new CustomEvent('skrimchat_post_saved', { detail: { postId, isSaving: true } }));
  },

  unsavePost: async (postId: string) => {
    try {
      await apiClient.post('/skrimchat-saved-items/unsave', { postId });
    } catch (e) {
      console.warn("Failed to unsave post via apiClient, fallback locally", e);
    }
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      localStorage.setItem(SAVED_KEY, JSON.stringify(ids.filter(id => id !== postId)));
      clearSavedAt(postId);
      const full: any[] = JSON.parse(localStorage.getItem(SAVED_FULL_KEY) || '[]');
      localStorage.setItem(SAVED_FULL_KEY, JSON.stringify(full.filter((p: any) => p.id !== postId)));
    } catch (e) {}
    await get().hydrate();
    window.dispatchEvent(new CustomEvent('skrimchat_post_saved', { detail: { postId, isSaving: false } }));
  },
}));

// Hydrate immediately upon import so it is populated on app initialization
try {
  useSavedStore.getState().hydrate();
} catch (e) {}
