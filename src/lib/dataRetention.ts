/**
 * Data Retention / Auto-Delete engine.
 *
 * Every deletable category (Pulse posts, Vibe posts, Saved items, Reshares,
 * Tags/mentions, Connect messages, Game coins) can be configured with its
 * own retention window. This module owns:
 *   - the duration options + defaults
 *   - calendar-correct age math for the 6-month/1-year options
 *   - the sweep that walks every store the app already uses and removes
 *     anything older than its configured window, cascading the removal
 *     to every place a copy of that item might live.
 *
 * The sweep is intentionally built on top of the app's existing
 * soft-delete/localStorage conventions (e.g. `skrimchat_deleted_post_ids`,
 * IndexedDB 'pulses'/'vibes' stores, the coins ledger) rather than
 * introducing a parallel data model.
 */

import { getAllRecords, deleteRecord } from './services/mediaStorage';
import { expireCoinTransactions } from './coinsWallet';

export type RetentionCategory =
  | 'pulse'
  | 'vibe'
  | 'saved'
  | 'reshare'
  | 'tags'
  | 'connectMessages'
  | 'gameCoins';

export const RETENTION_CATEGORIES: { id: RetentionCategory; label: string; description: string; icon: string }[] = [
  { id: 'pulse', label: 'Pulse Posts', description: 'Your posts in the Pulse feed', icon: '⚡' },
  { id: 'vibe', label: 'Vibe Posts', description: 'Your posts in Vibes', icon: '🎬' },
  { id: 'saved', label: 'Saved Items', description: 'Posts you bookmarked to view later', icon: '🔖' },
  { id: 'reshare', label: 'Reshares', description: 'Posts you reposted to your feed', icon: '🔁' },
  { id: 'tags', label: 'Tags & Mentions', description: 'Times you were tagged or mentioned', icon: '🏷️' },
  { id: 'connectMessages', label: 'Connect Messages', description: 'Direct messages in Connect', icon: '💬' },
  { id: 'gameCoins', label: 'Game Coins', description: 'Individual earned/purchased coin entries', icon: '🪙' },
];

// Only these eight values are ever valid — 6 months and 1 year are resolved
// with real calendar math rather than a flat 182/365-day approximation.
export const RETENTION_DURATIONS = [1, 7, 14, 28, 56, 84, 182, 365] as const;
export type RetentionDurationDays = typeof RETENTION_DURATIONS[number];

export const RETENTION_DURATION_LABELS: Record<RetentionDurationDays, string> = {
  1: '1 day',
  7: '7 days',
  14: '14 days',
  28: '28 days',
  56: '56 days',
  84: '84 days',
  182: '6 months',
  365: '1 year',
};

export type RetentionSettings = Record<RetentionCategory, RetentionDurationDays>;

export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = {
  pulse: 365,
  vibe: 365,
  saved: 365,
  reshare: 365,
  tags: 365,
  connectMessages: 365,
  gameCoins: 365,
};

export const RETENTION_SETTINGS_KEY = 'skrimchat_retention_settings';
export const RETENTION_ONBOARDED_KEY = 'skrimchat_retention_onboarded';
export const RETENTION_LAST_SWEEP_KEY = 'skrimchat_retention_last_sweep';

/**
 * Whether `createdAt` is older than `durationDays`, measured from `now`.
 * 182 (6 months) and 365 (1 year) use real calendar month/year subtraction
 * (via Date's setMonth/setFullYear, which correctly rolls over month
 * lengths and leap years) instead of a flat 182*24h / 365*24h window —
 * so e.g. content from Jan 31 with a 6-month window expires relative to
 * Jul 31 (or Jul 30/29 rollover), not exactly 4,368 hours later.
 */
export function isExpired(createdAt: number | undefined | null, durationDays: RetentionDurationDays, now: number = Date.now()): boolean {
  if (!createdAt || !Number.isFinite(createdAt)) return false;
  if (createdAt > now) return false; // clock skew / bad data guard

  if (durationDays === 182 || durationDays === 365) {
    const cutoff = new Date(now);
    if (durationDays === 182) {
      cutoff.setMonth(cutoff.getMonth() - 6);
    } else {
      cutoff.setFullYear(cutoff.getFullYear() - 1);
    }
    return createdAt < cutoff.getTime();
  }

  const ms = durationDays * 24 * 60 * 60 * 1000;
  return now - createdAt < -ms ? false : now - createdAt > ms;
}

// ── localStorage helpers ─────────────────────────────────────────────
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/disabled — nothing more we can do here
  }
}

export function loadRetentionSettings(): RetentionSettings {
  const stored = readJSON<Partial<RetentionSettings>>(RETENTION_SETTINGS_KEY, {});
  return { ...DEFAULT_RETENTION_SETTINGS, ...stored };
}

export function saveRetentionSettings(settings: RetentionSettings) {
  writeJSON(RETENTION_SETTINGS_KEY, settings);
}

export function isRetentionOnboarded(): boolean {
  try {
    return localStorage.getItem(RETENTION_ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markRetentionOnboarded() {
  try {
    localStorage.setItem(RETENTION_ONBOARDED_KEY, '1');
  } catch {}
}

// ── Cascade removal for a deleted Pulse post ────────────────────────
function cascadeRemovePulsePost(postId: string) {
  // Mark deleted so it's filtered out of the algorithmic feed the same
  // way manual deletes already work.
  const deletedIds = readJSON<string[]>('skrimchat_deleted_post_ids', []);
  if (!deletedIds.includes(postId)) {
    writeJSON('skrimchat_deleted_post_ids', [...deletedIds, postId]);
  }

  // Strip from every other user's / this user's Saved lists.
  const savedIds = readJSON<string[]>('skrimchat_saved_posts', []);
  if (savedIds.includes(postId)) {
    writeJSON('skrimchat_saved_posts', savedIds.filter(id => id !== postId));
  }
  const savedFull = readJSON<any[]>('skrimchat_saved_posts_full', []);
  if (savedFull.some(p => p?.id === postId)) {
    writeJSON('skrimchat_saved_posts_full', savedFull.filter(p => p?.id !== postId));
  }
  const savedAt = readJSON<Record<string, number>>('skrimchat_saved_at', {});
  if (savedAt[postId] !== undefined) {
    delete savedAt[postId];
    writeJSON('skrimchat_saved_at', savedAt);
  }

  // Strip from Reshares/Reposts.
  const reposts = readJSON<any[]>('skrimchat_reposts', []);
  const filteredReposts = reposts.filter(r => (r?.originalPost?.id || r?.id) !== postId);
  if (filteredReposts.length !== reposts.length) {
    writeJSON('skrimchat_reposts', filteredReposts);
  }

  // Strip engagement caches so no residual counts/reactions reference it.
  for (const key of ['skrimchat_like_counts', 'skrimchat_comment_counts', 'skrimchat_share_counts', 'skrimchat_post_reactions']) {
    const map = readJSON<Record<string, unknown>>(key, {});
    if (postId in map) {
      delete map[postId];
      writeJSON(key, map);
    }
  }
  const likedList = readJSON<string[]>('skrimchat_liked_posts', []);
  if (likedList.includes(postId)) {
    writeJSON('skrimchat_liked_posts', likedList.filter(id => id !== postId));
  }
  const myReactions = readJSON<Record<string, string>>('skrimchat_my_reactions', {});
  if (postId in myReactions) {
    delete myReactions[postId];
    writeJSON('skrimchat_my_reactions', myReactions);
  }
  const editedTexts = readJSON<Record<string, string>>('skrimchat_edited_post_texts', {});
  if (postId in editedTexts) {
    delete editedTexts[postId];
    writeJSON('skrimchat_edited_post_texts', editedTexts);
  }

  // Strip any signals referencing the deleted post.
  removeSignalsReferencing({ postId });
}

function cascadeRemoveVibePost(vibeId: string) {
  const deletedIds = readJSON<string[]>('skrimchat_deleted_vibe_ids', []);
  if (!deletedIds.includes(vibeId)) {
    writeJSON('skrimchat_deleted_vibe_ids', [...deletedIds, vibeId]);
  }

  for (const key of ['skrimchat_vibe_counts', 'skrimchat_vibe_comments', 'skrimchat_vibe_shares', 'skrimchat_vibe_reshares']) {
    const map = readJSON<Record<string, unknown>>(key, {});
    if (vibeId in map) {
      delete map[vibeId];
      writeJSON(key, map);
    }
  }
  const vibeLiked = readJSON<string[]>('skrimchat_vibe_liked', []);
  if (vibeLiked.includes(vibeId)) {
    writeJSON('skrimchat_vibe_liked', vibeLiked.filter(id => id !== vibeId));
  }

  // Saved copies of a Vibe post use the same saved-post keys as Pulse.
  const savedIds = readJSON<string[]>('skrimchat_saved_posts', []);
  if (savedIds.includes(vibeId)) {
    writeJSON('skrimchat_saved_posts', savedIds.filter(id => id !== vibeId));
  }
  const savedFull = readJSON<any[]>('skrimchat_saved_posts_full', []);
  if (savedFull.some(p => p?.id === vibeId)) {
    writeJSON('skrimchat_saved_posts_full', savedFull.filter(p => p?.id !== vibeId));
  }

  removeSignalsReferencing({ vibeId });
}

function removeSignalsReferencing(ref: { postId?: string; vibeId?: string }) {
  const matches = (n: any) =>
    (ref.postId && n?.postId === ref.postId) ||
    (ref.vibeId && n?.vibeId === ref.vibeId) ||
    (ref.postId && n?.spark?.id === ref.postId) ||
    (ref.vibeId && n?.spark?.id === ref.vibeId);

  const realNotifs = readJSON<any[]>('skrimchat_real_signals', []);
  const filteredReal = realNotifs.filter(n => !matches(n));
  if (filteredReal.length !== realNotifs.length) {
    writeJSON('skrimchat_real_signals', filteredReal);
  }

  const inAppNotifs = readJSON<any[]>('skrimchat_inapp_notifs', []);
  const filteredInApp = inAppNotifs.filter(n => !matches(n));
  if (filteredInApp.length !== inAppNotifs.length) {
    writeJSON('skrimchat_inapp_notifs', filteredInApp);
  }
}

// ── Per-category sweeps ──────────────────────────────────────────────

async function sweepPulse(durationDays: RetentionDurationDays, now: number) {
  let records: any[] = [];
  try {
    records = await getAllRecords('pulses');
  } catch {
    return;
  }
  for (const post of records) {
    if (isExpired(post?.createdAt, durationDays, now)) {
      try {
        await deleteRecord('pulses', post.id);
      } catch {}
      cascadeRemovePulsePost(post.id);
    }
  }
}

async function sweepVibe(durationDays: RetentionDurationDays, now: number) {
  let records: any[] = [];
  try {
    records = await getAllRecords('vibes');
  } catch {
    return;
  }
  for (const vibe of records) {
    if (isExpired(vibe?.createdAt, durationDays, now)) {
      try {
        await deleteRecord('vibes', vibe.id);
      } catch {}
      cascadeRemoveVibePost(vibe.id);
    }
  }
}

// Saved items expire based on *when they were saved*, independent of the
// Pulse/Vibe category's own window — matching "changing a value only
// affects future expiry checks" per-category isolation from the spec.
function sweepSaved(durationDays: RetentionDurationDays, now: number) {
  const savedAt = readJSON<Record<string, number>>('skrimchat_saved_at', {});
  const expiredIds = Object.keys(savedAt).filter(id => isExpired(savedAt[id], durationDays, now));
  if (expiredIds.length === 0) return;

  const expiredSet = new Set(expiredIds);
  const savedIds = readJSON<string[]>('skrimchat_saved_posts', []);
  writeJSON('skrimchat_saved_posts', savedIds.filter(id => !expiredSet.has(id)));
  const savedFull = readJSON<any[]>('skrimchat_saved_posts_full', []);
  writeJSON('skrimchat_saved_posts_full', savedFull.filter(p => !expiredSet.has(p?.id)));
  for (const id of expiredIds) delete savedAt[id];
  writeJSON('skrimchat_saved_at', savedAt);
}

function sweepReshare(durationDays: RetentionDurationDays, now: number) {
  const reposts = readJSON<any[]>('skrimchat_reposts', []);
  const kept = reposts.filter(r => !isExpired(r?.createdAt, durationDays, now));
  if (kept.length !== reposts.length) {
    writeJSON('skrimchat_reposts', kept);
  }
}

// Tags/mentions live in two places depending on how they were generated:
// the real signal store's persisted array, and the lightweight
// "in-app" signal queue used by Sparks/Pulse for live toasts.
function sweepTags(durationDays: RetentionDurationDays, now: number) {
  const realNotifs = readJSON<any[]>('skrimchat_real_signals', []);
  const keptReal = realNotifs.filter(n => {
    if (n?.type !== 'mention') return true;
    return !isExpired(n?.createdAt, durationDays, now);
  });
  if (keptReal.length !== realNotifs.length) {
    writeJSON('skrimchat_real_signals', keptReal);
  }

  const inAppNotifs = readJSON<any[]>('skrimchat_inapp_notifs', []);
  const isTagLike = (n: any) => n?.type === 'mention' || n?.type === 'tag';
  const keptInApp = inAppNotifs.filter((n: any) => {
    if (!isTagLike(n)) return true;
    return !isExpired(n?.timestamp, durationDays, now);
  });
  if (keptInApp.length !== inAppNotifs.length) {
    writeJSON('skrimchat_inapp_notifs', keptInApp);
  }

  const mentionNotifs = readJSON<any[]>('skrimchat_mention_notifs', []);
  const keptMentions = mentionNotifs.filter((n: any) => !isExpired(n?.createdAt ?? n?.timestamp, durationDays, now));
  if (keptMentions.length !== mentionNotifs.length) {
    writeJSON('skrimchat_mention_notifs', keptMentions);
  }
}

// Connect messages live per-chat under `skrimchat_messages_<chatId>`, plus
// story replies/reactions and Spark shares stitched onto
// `skrimchat_custom_chats`. Both are swept directly since there's no
// central chat-id registry — this scan is cheap (localStorage only).
function sweepConnectMessages(durationDays: RetentionDurationDays, now: number) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('skrimchat_messages_')) continue;
      const messages = readJSON<any[]>(key, []);
      const kept = messages.filter(m => !isExpired(m?.createdAt, durationDays, now));
      if (kept.length !== messages.length) {
        writeJSON(key, kept);
      }
    }
  } catch {}

  const customChats = readJSON<Record<string, any[]>>('skrimchat_custom_chats', {});
  let changed = false;
  for (const chatKey of Object.keys(customChats)) {
    const messages = customChats[chatKey] || [];
    const kept = messages.filter((m: any) => !isExpired(m?.createdAt, durationDays, now));
    if (kept.length !== messages.length) {
      customChats[chatKey] = kept;
      changed = true;
    }
  }
  if (changed) writeJSON('skrimchat_custom_chats', customChats);
}

function sweepGameCoins(durationDays: RetentionDurationDays, now: number) {
  expireCoinTransactions(durationDays, now, isExpired);
}

export interface RetentionSweepResult {
  ranAt: number;
  categoriesSwept: RetentionCategory[];
}

/**
 * Runs the full deletion pass across every configured category. Safe to
 * call repeatedly (on app load and on an interval) — each sweep is
 * idempotent since it only ever removes items that are actually expired.
 */
export async function runRetentionSweep(settings?: RetentionSettings): Promise<RetentionSweepResult> {
  const resolved = settings || loadRetentionSettings();
  const now = Date.now();

  await sweepPulse(resolved.pulse, now);
  await sweepVibe(resolved.vibe, now);
  sweepSaved(resolved.saved, now);
  sweepReshare(resolved.reshare, now);
  sweepTags(resolved.tags, now);
  sweepConnectMessages(resolved.connectMessages, now);
  sweepGameCoins(resolved.gameCoins, now);

  writeJSON(RETENTION_LAST_SWEEP_KEY, now);
  try {
    window.dispatchEvent(new Event('skrimchat_retention_swept'));
  } catch {}

  return { ranAt: now, categoriesSwept: RETENTION_CATEGORIES.map(c => c.id) };
}

/** Records when a post/item is saved, so the Saved category can expire
 *  independently of the underlying post's own retention window. */
export function markSavedAt(postId: string, when: number = Date.now()) {
  const savedAt = readJSON<Record<string, number>>('skrimchat_saved_at', {});
  savedAt[postId] = when;
  writeJSON('skrimchat_saved_at', savedAt);
}

export function clearSavedAt(postId: string) {
  const savedAt = readJSON<Record<string, number>>('skrimchat_saved_at', {});
  if (postId in savedAt) {
    delete savedAt[postId];
    writeJSON('skrimchat_saved_at', savedAt);
  }
}
