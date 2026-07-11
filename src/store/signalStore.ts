import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

export interface Signal {
  id: string;
  type: 'pulse' | 'comment' | 'mention' | 'follow' | 'fomo' | 'collab_invite' | 'new_vibe' | 'vibe_like' | 'vibe_comment' | 'vibe_reply' | 'grind_reminder' | 'lang_match' | 'alert' | 'world_join' | 'game_invite' | 'world_admin' | 'message';
  user: string;
  avatar: string;
  text: string;
  time: string;
  isRead: boolean;
  postId?: string;
  vibeId?: string;
  commentId?: string;
  sparkId?: string;
  spark?: any;
  languages?: string[];
  thumbnail?: string;
  worldId?: string;
  chatId?: string;
  createdAt?: number; // epoch ms — used by the Data Retention engine for Tags/mentions expiry
}

interface SignalState {
  globalVibeSignalsEnabled: boolean;
  toggleGlobalVibeSignals: () => void;
  likesSignalsEnabled: boolean;
  toggleLikesSignals: (val: boolean) => void;
  likesMilestonesOnly: boolean;
  toggleLikesMilestonesOnly: (val: boolean) => void;
  commentsSignalsEnabled: boolean;
  toggleCommentsSignals: (val: boolean) => void;
  repliesSignalsEnabled: boolean;
  toggleRepliesSignals: (val: boolean) => void;
  blazeRunRemindersEnabled: boolean;
  toggleBlazeRunReminders: (val: boolean) => void;
  blazeRunReminderTime: string;
  setBlazeRunReminderTime: (val: string) => void;
  pulseRewardsEnabled: boolean;
  togglePulseRewards: (val: boolean) => void;
  languageMatchSignalsEnabled: boolean;
  toggleLanguageMatchSignals: (val: boolean) => void;
  requestPushPermission: () => void;
  creatorSignalPrefs: Record<string, boolean>;
  toggleCreatorSignals: (id: string) => void;
  pulseToasts: any[];
  removePulseToast: (id: string) => void;
  soundEffectsEnabled: boolean;
  toggleSoundEffects: () => void;
  addToast: (points: number, message: string) => void;
  
  // Real signals array and actions
  signals: Signal[];
  fetchSignals: () => Promise<void>;
  addSignal: (signal: Omit<Signal, 'id' | 'isRead'>) => Promise<void>;
  markSignalAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
    osc2.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5
    
    osc1.type = "sine";
    osc2.type = "triangle";
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.95);
    
    osc1.start(audioCtx.currentTime);
    osc2.start(audioCtx.currentTime);
    
    osc1.stop(audioCtx.currentTime + 1.0);
    osc2.stop(audioCtx.currentTime + 1.0);
  } catch (e) {
    console.warn("AudioContext failed or blocked:", e);
  }
};

const getInitialSignals = (): Signal[] => {
  try {
    const stored = localStorage.getItem('skrimchat_real_signals');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return []; // Mock seed data removed
};

export const useSignalStore = create<SignalState>((set, get) => ({
  globalVibeSignalsEnabled: true,
  toggleGlobalVibeSignals: () => set((state) => ({ globalVibeSignalsEnabled: !state.globalVibeSignalsEnabled })),
  likesSignalsEnabled: true,
  toggleLikesSignals: (val) => set({ likesSignalsEnabled: val }),
  likesMilestonesOnly: false,
  toggleLikesMilestonesOnly: (val) => set({ likesMilestonesOnly: val }),
  commentsSignalsEnabled: true,
  toggleCommentsSignals: (val) => set({ commentsSignalsEnabled: val }),
  repliesSignalsEnabled: true,
  toggleRepliesSignals: (val) => set({ repliesSignalsEnabled: val }),
  blazeRunRemindersEnabled: true,
  toggleBlazeRunReminders: (val) => set({ blazeRunRemindersEnabled: val }),
  blazeRunReminderTime: '21:00',
  setBlazeRunReminderTime: (val) => set({ blazeRunReminderTime: val }),
  pulseRewardsEnabled: true,
  togglePulseRewards: (val) => set({ pulseRewardsEnabled: val }),
  languageMatchSignalsEnabled: true,
  toggleLanguageMatchSignals: (val) => set({ languageMatchSignalsEnabled: val }),
  requestPushPermission: () => {},
  creatorSignalPrefs: {},
  toggleCreatorSignals: (id) => set((state) => ({ creatorSignalPrefs: { ...state.creatorSignalPrefs, [id]: !state.creatorSignalPrefs[id] } })),
  pulseToasts: [],
  removePulseToast: (id) => set((state) => ({ pulseToasts: state.pulseToasts.filter(toast => toast.id !== id) })),
  soundEffectsEnabled: true,
  toggleSoundEffects: () => set((state) => ({ soundEffectsEnabled: !state.soundEffectsEnabled })),
  addToast: (points, message) => set((state) => {
    if (state.soundEffectsEnabled) {
      playChime();
    }
    const newToast = {
      id: `toast-${Date.now()}`,
      points,
      message,
      total: 12500 + points,
    };
    return { pulseToasts: [...state.pulseToasts, newToast] };
  }),

  signals: getInitialSignals(),
  fetchSignals: async () => {
    try {
      const data = await apiClient.get<Signal[]>('/skrimchat-notifications');
      set({ signals: data });
    } catch (err) {
      console.warn("Failed to fetch notifications via apiClient, keeping local state.", err);
    }
  },
  addSignal: async (signal) => {
    const { type } = signal;

    // Respect existing preference toggles
    if ((type === 'vibe_like' || type === 'pulse') && !get().likesSignalsEnabled) {
      return;
    }
    if ((type === 'vibe_comment' || type === 'comment') && !get().commentsSignalsEnabled) {
      return;
    }
    if (type === 'vibe_reply' && !get().repliesSignalsEnabled) {
      return;
    }
    if (type === 'new_vibe' && !get().globalVibeSignalsEnabled) {
      return;
    }
    if (type === 'grind_reminder' && !get().blazeRunRemindersEnabled) {
      return;
    }
    if (type === 'lang_match' && !get().languageMatchSignalsEnabled) {
      return;
    }

    try {
      const newNotif = await apiClient.post<Signal>('/skrimchat-notifications', signal);
      set((state) => {
        const updated = [newNotif, ...state.signals];
        const unread = updated.filter(n => !n.isRead).length;
        localStorage.setItem('skrimchat_signal_unread', String(unread));
        window.dispatchEvent(new CustomEvent('skrimchat_signal_badge', { detail: unread }));
        return { signals: updated };
      });
    } catch (err) {
      console.warn("Failed to create notification on backend, saving locally.", err);
      const newNotif: Signal = {
        ...signal,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isRead: false,
        createdAt: signal.createdAt ?? Date.now(),
      };

      set((state) => {
        const updated = [newNotif, ...state.signals];
        try {
          localStorage.setItem('skrimchat_real_signals', JSON.stringify(updated));
        } catch (e) {}
        
        const unread = updated.filter(n => !n.isRead).length;
        localStorage.setItem('skrimchat_signal_unread', String(unread));
        window.dispatchEvent(new CustomEvent('skrimchat_signal_badge', { detail: unread }));

        return { signals: updated };
      });
    }
  },
  markSignalAsRead: async (id) => {
    try {
      await apiClient.post(`/skrimchat-notifications/${id}/read`, {});
    } catch (err) {
      console.warn(`Failed to mark notification ${id} as read on backend.`, err);
    }
    set((state) => {
      const updated = state.signals.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      try {
        localStorage.setItem('skrimchat_real_signals', JSON.stringify(updated));
      } catch (e) {}

      const unread = updated.filter(n => !n.isRead).length;
      localStorage.setItem('skrimchat_signal_unread', String(unread));
      window.dispatchEvent(new CustomEvent('skrimchat_signal_badge', { detail: unread }));

      return { signals: updated };
    });
  },
  markAllAsRead: async () => {
    try {
      await apiClient.post('/skrimchat-notifications/read-all', {});
    } catch (err) {
      console.warn("Failed to mark all notifications as read on backend.", err);
    }
    set((state) => {
      const updated = state.signals.map((n) => ({ ...n, isRead: true }));
      try {
        localStorage.setItem('skrimchat_real_signals', JSON.stringify(updated));
      } catch (e) {}

      localStorage.setItem('skrimchat_signal_unread', '0');
      window.dispatchEvent(new CustomEvent('skrimchat_signal_badge', { detail: 0 }));

      return { signals: updated };
    });
  },
}));

// Mock functions
export const simulateCreatorPost = (user: any, reel: any) => {};
export const simulateVibeLike = (user: any, reel: any, likes: number) => {};
export const simulateVibeComment = (user: any, comment: any, reel: any, reply: boolean) => {};
export const scheduleGrindReminder = () => {};
export const showGrindSignal = (count: number) => {};
export const checkGrindRisk = () => ({ atRisk: false, grindCount: 0 });

export const simulatePulseReward = (event: string) => {
  let points = 50;
  let msg = "Unlocked achievement!";
  if (event.includes("milestone")) {
    points = 100;
    msg = "Reached a brand new follower milestone! 🏆";
  } else if (event.includes("streak")) {
    points = 200;
    msg = "Blaze Streak is hot! You got bonus points! 🔥";
  } else if (event.includes("vibe")) {
    points = 30;
    msg = "Your Vibe post is trending today! 📈";
  } else if (event.includes("birthday")) {
    points = 75;
    msg = "Spark wish successfully sent! Friend is happy! 🎉";
  } else {
    points = 50;
    msg = event || "Received Pulse Reward! ⚡";
  }
  
  useSignalStore.getState().addToast(points, msg);
};

export const simulateLanguageMatchSignal = (langs: string[], count: number, force: boolean) => {};
