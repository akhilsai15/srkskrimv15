import { create } from "zustand";

export type SignalType =
  | "voice_room"
  | "announcement"
  | "spark_milestone"
  | "achievement"
  | "exclusive_post"
  | "new_members"
  | "world_event"
  | "comment_reply";

export interface WorldSignal {
  id: string;
  type: SignalType;
  communityId: string;
  communityName: string;
  atmosphere: string;
  content: string;
  detail?: string;
  listeners?: number;
  isLive?: boolean;
  time: string;
  timestamp: number;
  read: boolean;
  milestone?: number;
  postId?: string;
  member?: string;
  level?: string;
}

export interface BannerInfo {
  id: string;
  signal: WorldSignal;
  duration: number; // in ms
}

interface WorldSignalState {
  signals: WorldSignal[];
  activeBanner: BannerInfo | null;
  hasUnseen: boolean;
  addSignal: (
    n: Omit<WorldSignal, "id" | "read" | "timestamp"> & {
      duration?: number;
    },
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteSignal: (id: string) => void;
  clearBanner: () => void;
  clearUnseen: () => void;
}

const INITIAL_NOTIFS: WorldSignal[] = [
  {
    id: "wn_001",
    type: "voice_room",
    communityId: "c001",
    communityName: "SkrimGamers",
    atmosphere: "nebula",
    content: "SkrimGamers started a Voice Room",
    detail: "Evening Gaming Session",
    listeners: 14,
    isLive: true,
    time: "10 minutes ago",
    timestamp: Date.now() - 10 * 60000,
    read: false,
  },
  {
    id: "wn_002",
    type: "announcement",
    communityId: "c002",
    communityName: "GrindMode",
    atmosphere: "crimson",
    content: "GrindMode posted an announcement",
    detail: "Weekly workout plan is up!",
    time: "1 hour ago",
    timestamp: Date.now() - 60 * 60000,
    read: false,
  },
  {
    id: "wn_003",
    type: "spark_milestone",
    communityId: "c001",
    communityName: "SkrimGamers",
    atmosphere: "nebula",
    content: "Your post hit 50 Sparks! 🎉",
    milestone: 50,
    postId: "p004",
    time: "2 hours ago",
    timestamp: Date.now() - 120 * 60000,
    read: true,
  },
  {
    id: "wn_004",
    type: "achievement",
    communityId: "c001",
    communityName: "SkrimGamers",
    atmosphere: "nebula",
    content: "Priya became a Legend in SkrimGamers",
    member: "Priya",
    level: "Legend",
    time: "3 hours ago",
    timestamp: Date.now() - 180 * 60000,
    read: true,
  },
  {
    id: "wn_005",
    type: "exclusive_post",
    communityId: "c002",
    communityName: "GrindMode",
    atmosphere: "crimson",
    content: "GrindMode exclusive post:",
    detail: "Advanced workout guide",
    time: "1 day ago",
    timestamp: Date.now() - 24 * 60 * 60000,
    read: true,
  },
  {
    id: "wn_006",
    type: "new_members",
    communityId: "c001",
    communityName: "SkrimGamers",
    atmosphere: "nebula",
    content: "14 new members joined SkrimGamers today",
    time: "1 day ago",
    timestamp: Date.now() - 24 * 60 * 60000,
    read: true,
  },
];

export const useWorldSignalStore = create<WorldSignalState>(
  (set, get) => ({
    signals: INITIAL_NOTIFS,
    activeBanner: null,
    hasUnseen: INITIAL_NOTIFS.some((n) => !n.read),
    addSignal: (n) => {
      const newNotif: WorldSignal = {
        ...n,
        id: `wn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        read: false,
        timestamp: Date.now(),
      };

      set((state) => ({
        signals: [newNotif, ...state.signals],
        hasUnseen: true,
        activeBanner: {
          id: newNotif.id,
          signal: newNotif,
          duration: n.duration || (n.type === "voice_room" ? 6000 : 4000),
        },
      }));
    },
    markAsRead: (id) =>
      set((state) => ({
        signals: state.signals.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      })),
    markAllAsRead: () =>
      set((state) => ({
        signals: state.signals.map((n) => ({ ...n, read: true })),
        hasUnseen: false,
      })),
    deleteSignal: (id) =>
      set((state) => ({
        signals: state.signals.filter((n) => n.id !== id),
      })),
    clearBanner: () => set({ activeBanner: null }),
    clearUnseen: () => set({ hasUnseen: false }),
  }),
);
