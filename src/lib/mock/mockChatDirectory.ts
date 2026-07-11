// Single source of truth for "who is this chat with" lookups.
// ConnectScreen renders this list and routes to /chat/:id using these ids.
// ChatThreadScreen (and anything else that needs to know the other person's
// name/avatar for a given chatId) should resolve through getChatById()
// instead of hardcoding a name, so the header/messages/challenges always
// show the correct person for whichever chat is actually open.

import { mockUsers } from './mockData';
import { apiClient } from '../apiClient';

export interface MockChatEntry {
  id: string;
  name: string;
  avatar: string;
  avatar2?: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  blazeGrind: number;
  pinned: boolean;
  isGroup?: boolean;
  username?: string;
}

export const MOCK_CHATS: MockChatEntry[] = [
  { id: "1", name: "Dolly Devi Tiwari", username: "dolly_ka_dhaba", avatar: "https://i.pravatar.cc/150?img=5", lastMessage: "Did you watch that vibe I sent? 🔥", time: "2:34 PM", unread: 3, online: true, blazeGrind: 7, pinned: true },
  { id: "2", name: "Pappu Pandey", username: "pappu_pass_hogaya", avatar: "https://i.pravatar.cc/150?img=2", lastMessage: "🎤 Voice message", time: "1:15 PM", unread: 0, online: false, blazeGrind: 14, pinned: false },
  { id: "3", name: "Telugu Squad 🔥", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=telugu1", avatar2: "https://api.dicebear.com/7.x/avataaars/svg?seed=telugu2", lastMessage: "Arjun: Oka vibe chudandi guys!", time: "12:03 PM", unread: 12, online: false, isGroup: true, blazeGrind: 0, pinned: true },
  { id: "4", name: "Pinky Patel", username: "pinky_se_pink_nahi", avatar: "https://i.pravatar.cc/150?img=9", lastMessage: "You: 😂😂😂", time: "Yesterday", unread: 0, online: true, blazeGrind: 3, pinned: false },
  { id: "5", name: "Raju Rastogi", username: "raju_3idiots_fan", avatar: "https://i.pravatar.cc/150?img=4", lastMessage: "🎮 Game Challenge!", time: "Yesterday", unread: 1, online: false, blazeGrind: 30, pinned: false },
  { id: "6", name: "Munni Lal Verma", username: "munni_badnaam_nahi", avatar: "https://i.pravatar.cc/150?img=7", lastMessage: "📷 Photo", time: "Mon", unread: 0, online: false, blazeGrind: 0, pinned: false },
  { id: "7", name: "Vibes Gang 🌟", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=vibes1", avatar2: "https://api.dicebear.com/7.x/avataaars/svg?seed=vibes2", lastMessage: "Priya: sending good vibes only✨", time: "Sun", unread: 5, online: false, isGroup: true, blazeGrind: 0, pinned: false }
];

let cachedChats: MockChatEntry[] = [...MOCK_CHATS];

export async function getChatsFromApi(): Promise<MockChatEntry[]> {
  try {
    const list = await apiClient.get<MockChatEntry[]>('/chats');
    cachedChats = list;
    return list;
  } catch (err) {
    console.warn("TODO: Real backend GET /chats not ready. Using cached/local state.", err);
    return cachedChats;
  }
}

export async function createChatOnApi(chat: Partial<MockChatEntry>): Promise<MockChatEntry> {
  try {
    const created = await apiClient.post<MockChatEntry>('/chats', chat);
    const existingIdx = cachedChats.findIndex(c => c.id === created.id);
    if (existingIdx > -1) {
      cachedChats[existingIdx] = created;
    } else {
      cachedChats.push(created);
    }
    return created;
  } catch (err) {
    console.warn("TODO: Real backend POST /chats not ready. Mocking creation.", err);
    const mockCreated: MockChatEntry = {
      id: chat.id || Date.now().toString(),
      name: chat.name || 'Chat',
      avatar: chat.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown',
      lastMessage: chat.lastMessage || '',
      time: chat.time || 'Just now',
      unread: chat.unread || 0,
      online: chat.online !== undefined ? chat.online : true,
      blazeGrind: chat.blazeGrind || 0,
      pinned: chat.pinned || false,
      isGroup: chat.isGroup,
      username: chat.username
    };
    cachedChats.push(mockCreated);
    return mockCreated;
  }
}

/**
 * Resolve a chat participant (or group) by the id used in the /chat/:id route.
 * Falls back gracefully for custom/group chats created at runtime
 * (ids like "custom_<username>" or "group_<timestamp>") by checking
 * localStorage, then finally to a generic placeholder instead of a
 * hardcoded real-looking name.
 */
export function getChatById(chatId?: string | null): { displayName: string; avatar: string; isGroup: boolean; username?: string } {
  if (!chatId) {
    return { displayName: 'Chat', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown', isGroup: false };
  }

  const fromCache = cachedChats.find(c => c.id === chatId);
  if (fromCache) {
    return { displayName: fromCache.name, avatar: fromCache.avatar, isGroup: !!fromCache.isGroup, username: fromCache.username };
  }

  // Custom 1:1 chats created via "custom_<username>" keys (see ConnectScreen / shareSpark)
  if (chatId.startsWith('custom_')) {
    const username = chatId.replace('custom_', '');
    const matched = mockUsers.find((u: any) => u.username?.replace('@', '') === username);
    if (matched) {
      return { displayName: matched.displayName, avatar: matched.avatar, isGroup: false, username: matched.username };
    }
    // Fall back to a readable version of the username itself
    return { displayName: username, avatar: `https://i.pravatar.cc/150?u=${username}`, isGroup: false, username };
  }

  // Custom groups created via GroupCreateFlow ("group_<timestamp>")
  if (chatId.startsWith('group_')) {
    try {
      const storedGroupsStr = localStorage.getItem('skrimchat_custom_groups');
      if (storedGroupsStr) {
        const groups = JSON.parse(storedGroupsStr);
        const matched = groups.find((g: any) => g.id === chatId);
        if (matched) {
          return { displayName: matched.name, avatar: matched.avatar, isGroup: true };
        }
      }
    } catch (e) {}
  }

  return { displayName: 'Chat', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown', isGroup: false };
}

export async function getChatByIdAsync(chatId?: string | null): Promise<{ displayName: string; avatar: string; isGroup: boolean; username?: string }> {
  try {
    const remoteChat = await apiClient.get<{ displayName: string; avatar: string; isGroup: boolean; username?: string }>(`/chats/${chatId}`);
    return remoteChat;
  } catch (err) {
    console.warn("TODO: Real backend GET /chats/:id not ready. Falling back to local/cached lookup.", err);
    return getChatById(chatId);
  }
}

