// Mock data for the Orbit ("Orbit") discovery feature.
// Mirrors the conventions used in mockData.ts / mockSocialGraph.ts —
// deterministic, seeded-looking data instead of fully random noise.

import { apiClient } from '../apiClient';

export type MoodStatus = 'want_to_chat' | 'busy' | 'looking_for_friends' | 'study_partner' | 'invisible';

export const MOOD_META: Record<MoodStatus, { label: string; emoji: string; color: string }> = {
  want_to_chat: { label: 'Want to Chat', emoji: '🟢', color: '#22C55E' },
  busy: { label: 'Busy', emoji: '🟡', color: '#EAB308' },
  looking_for_friends: { label: 'Looking for Friends', emoji: '🔵', color: '#3B82F6' },
  study_partner: { label: 'Study Partner', emoji: '🟣', color: '#B026FF' },
  invisible: { label: 'Invisible', emoji: '🔴', color: '#EF4444' },
};

export type PresenceDuration = '15m' | '1h' | '3h' | 'always';

export const PRESENCE_META: Record<PresenceDuration, { label: string; ms: number | null }> = {
  '15m': { label: '15 minutes', ms: 15 * 60 * 1000 },
  '1h': { label: '1 hour', ms: 60 * 60 * 1000 },
  '3h': { label: '3 hours', ms: 3 * 60 * 60 * 1000 },
  always: { label: 'Always', ms: null },
};

export type ReputationTag = 'friendly' | 'helpful' | 'funny' | 'respectful';

export interface OrbitUser {
  id: string;
  nickname: string;
  avatar: string;
  distanceKm: number;
  // Direction (degrees, 0 = north, clockwise) used to place this user relative
  // to the real device location once we have it, so distance can be computed
  // with genuine haversine math instead of a static number.
  bearingDeg: number;
  interests: string[];
  mood: MoodStatus;
  age: number;
  genderForFilter: 'male' | 'female' | 'other';
  isVerified: boolean;
  reputation: Record<ReputationTag, number>;
  bio: string;
  lastSeenMins: number;
  crossedPathsToday: boolean;
}

const interestPool = [
  'Photography', 'Music', 'Travel', 'Movies', 'Anime', 'Cricket', 'AI',
  'Gaming', 'Cooking', 'Fitness', 'Books', 'Coding', 'Coffee', 'Art',
  'Dance', 'Hiking', 'Cars', 'Fashion', 'Startups', 'Comedy',
];

const nicknames = [
  'MoonGirl', 'PixelRahul', 'SkyDrifter', 'NightOwl_P', 'CodeCat',
  'WanderSai', 'EchoVibe', 'StormChaser', 'QuietStorm', 'NovaJoy',
  'DriftKing', 'PaperPlane', 'SunnySide_R', 'CricketFan99', 'InkAndTea',
];

function pick<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  let i = seed;
  while (out.length < n && out.length < arr.length) {
    const idx = i % arr.length;
    if (!out.includes(arr[idx])) out.push(arr[idx]);
    i += 7;
  }
  return out;
}

export const mockOrbitUsers: OrbitUser[] = nicknames.map((nickname, i) => {
  const seed = i * 13 + 5;
  return {
    id: `orbit_${i + 1}`,
    nickname,
    avatar: `https://i.pravatar.cc/150?img=${((i + 20) % 70) + 1}`,
    distanceKm: parseFloat(((i + 1) * 1.7 % 50 + 0.5).toFixed(1)),
    bearingDeg: (i * 47 + 23) % 360,
    interests: pick(interestPool, 3, seed),
    mood: (['want_to_chat', 'busy', 'looking_for_friends', 'study_partner', 'want_to_chat', 'looking_for_friends'] as MoodStatus[])[i % 6],
    age: 18 + ((i * 5) % 24),
    genderForFilter: (['female', 'male', 'other'] as const)[i % 3],
    isVerified: i % 3 === 0,
    reputation: {
      friendly: 60 + ((i * 7) % 40),
      helpful: 40 + ((i * 11) % 50),
      funny: 50 + ((i * 3) % 45),
      respectful: 70 + ((i * 5) % 30),
    },
    bio: 'Just exploring orbit, say hi if we share something in common!',
    lastSeenMins: (i * 4) % 60,
    crossedPathsToday: i % 4 === 0,
  };
});

export type IcebreakerType = 'coffee' | 'gaming' | 'movie' | 'sayhi';

export const ICEBREAKER_META: Record<IcebreakerType, { label: string; emoji: string }> = {
  coffee: { label: 'Coffee?', emoji: '☕' },
  gaming: { label: 'Gaming?', emoji: '🎮' },
  movie: { label: 'Movie fan?', emoji: '🎬' },
  sayhi: { label: 'Say Hi', emoji: '👋' },
};

export interface ActivityRoom {
  id: string;
  name: string;
  emoji: string;
  orbitCount: number;
}

export const mockActivityRooms: ActivityRoom[] = [
  { id: 'room_coffee', name: 'Coffee Lovers', emoji: '☕', orbitCount: 6 },
  { id: 'room_gamers', name: 'Gamers', emoji: '🎮', orbitCount: 11 },
  { id: 'room_devs', name: 'Developers', emoji: '💻', orbitCount: 4 },
  { id: 'room_gym', name: 'Gym Buddies', emoji: '💪', orbitCount: 8 },
  { id: 'room_books', name: 'Book Readers', emoji: '📚', orbitCount: 3 },
];

export interface OrbitEvent {
  id: string;
  text: string;
  cta: string;
  count: number;
}

export const mockOrbitEvents: OrbitEvent[] = [
  { id: 'evt_dev', text: '4 developers orbit', cta: 'Create a coding room?', count: 4 },
  { id: 'evt_cricket', text: '8 cricket fans orbit', cta: 'Start a discussion?', count: 8 },
  { id: 'evt_movie', text: '5 movie buffs orbit', cta: 'Start a watch party chat?', count: 5 },
];

export async function getOrbitUsersAsync(): Promise<OrbitUser[]> {
  try {
    return await apiClient.get<OrbitUser[]>('/presence/orbit/users');
  } catch (err) {
    console.warn("TODO: Real backend GET /presence/orbit/users not ready. Returning mock.", err);
    return mockOrbitUsers;
  }
}

export async function getActivityRoomsAsync(): Promise<ActivityRoom[]> {
  try {
    return await apiClient.get<ActivityRoom[]>('/presence/orbit/rooms');
  } catch (err) {
    console.warn("TODO: Real backend GET /presence/orbit/rooms not ready. Returning mock.", err);
    return mockActivityRooms;
  }
}

export async function getOrbitEventsAsync(): Promise<OrbitEvent[]> {
  try {
    return await apiClient.get<OrbitEvent[]>('/presence/orbit/events');
  } catch (err) {
    console.warn("TODO: Real backend GET /presence/orbit/events not ready. Returning mock.", err);
    return mockOrbitEvents;
  }
}

export async function updatePresenceAsync(mood: MoodStatus, duration: PresenceDuration): Promise<void> {
  try {
    await apiClient.post('/presence/orbit/update', { mood, duration });
  } catch (err) {
    console.warn("TODO: Real backend POST /presence/orbit/update not ready.", err);
  }
}

