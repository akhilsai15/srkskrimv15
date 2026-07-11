// Skrim Coins — earned by playing Discover games, redeemable as ad budget
// in Promote. Mirrors the existing `incrementStat` pattern in
// achievementEngine.ts (localStorage + a window event so any open screen
// can react live), kept in its own file since coins are a distinct
// currency from Pulse score, not just another tracked stat.

import { apiClient } from './apiClient';

const COINS_KEY = "skrimchat_coins";
const COINS_LOG_KEY = "skrimchat_coins_log"; // recent earn/spend history, for the "Coins" screen

export interface CoinsLogEntry {
  id: string;
  type: "earn" | "spend";
  amount: number;
  reason: string; // e.g. "Snake — new high score" or "Redeemed for ad budget"
  timestamp: number;
}

// 1 rupee of ad budget per 100,000 coins, as requested. Kept as a named
// constant (not buried in StepBudget) so the rate only ever needs to
// change in one place.
export const COINS_PER_RUPEE = 100_000;

export function coinsToRupees(coins: number): number {
  return coins / COINS_PER_RUPEE;
}

export function rupeesToCoins(rupees: number): number {
  return Math.round(rupees * COINS_PER_RUPEE);
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore — storage disabled or quota exceeded; coins just won't persist
  }
}

export async function getCoins(): Promise<number> {
  try {
    const res = await apiClient.get<{ balance: number }>('/skrimchat-coins/balance');
    return res.balance;
  } catch (err) {
    console.warn("TODO: Real backend GET /skrimchat-coins/balance not ready. Returning local fallback.", err);
    return getCoinsLocal();
  }
}

export function getCoinsLocal(): number {
  const raw = safeGet(COINS_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function getCoinsLog(): Promise<CoinsLogEntry[]> {
  try {
    return await apiClient.get<CoinsLogEntry[]>('/skrimchat-coins/transactions');
  } catch (err) {
    console.warn("TODO: Real backend GET /skrimchat-coins/transactions not ready. Returning local fallback.", err);
    return getCoinsLogLocal();
  }
}

export function getCoinsLogLocal(): CoinsLogEntry[] {
  const raw = safeGet(COINS_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendLog(entry: CoinsLogEntry) {
  // Kept generously long (not just the 50 shown in the Coins screen) so the
  // Data Retention engine has a real per-transaction ledger to expire
  // oldest-first, rather than only ever seeing the most recent 50.
  const log = [entry, ...getCoinsLogLocal()].slice(0, 2000);
  safeSet(COINS_LOG_KEY, JSON.stringify(log));
}

/**
 * Expires individual coin-log entries once they cross the configured
 * retention age, oldest-first, subtracting only that entry's amount from
 * the running balance rather than wiping the whole wallet at once.
 */
export function expireCoinTransactions(
  durationDays: number,
  now: number,
  isExpired: (createdAt: number | undefined | null, durationDays: any, now: number) => boolean
): void {
  const log = getCoinsLogLocal();
  if (log.length === 0) return;

  // Oldest first so earlier grants are pruned before more recent ones.
  const sortedOldestFirst = [...log].sort((a, b) => a.timestamp - b.timestamp);
  const expiredIds = new Set<string>();
  let balanceDelta = 0;

  for (const entry of sortedOldestFirst) {
    if (!isExpired(entry.timestamp, durationDays, now)) continue;
    expiredIds.add(entry.id);
    if (entry.type === 'earn') {
      balanceDelta -= entry.amount;
    }
  }

  if (expiredIds.size === 0) return;

  const remainingLog = log.filter(e => !expiredIds.has(e.id));
  safeSet(COINS_LOG_KEY, JSON.stringify(remainingLog));

  if (balanceDelta !== 0) {
    const next = Math.max(0, getCoinsLocal() + balanceDelta);
    safeSet(COINS_KEY, next.toString());
  }
  notify();
}

function notify() {
  window.dispatchEvent(new Event("skrimchat_coins_updated"));
}

/** Adds coins (earning). */
export async function addCoins(amount: number, reason: string): Promise<number> {
  try {
    const res = await apiClient.post<{ balance: number }>('/skrimchat-coins/earn', { amount, reason });
    notify();
    return res.balance;
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-coins/earn not ready. Returning local fallback.", err);
    return addCoinsLocal(amount, reason);
  }
}

export function addCoinsLocal(amount: number, reason: string): number {
  if (amount <= 0) return getCoinsLocal();
  const next = getCoinsLocal() + Math.round(amount);
  safeSet(COINS_KEY, next.toString());
  appendLog({ id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: "earn", amount: Math.round(amount), reason, timestamp: Date.now() });
  notify();
  return next;
}

/** Spends coins if there's enough balance. */
export async function spendCoins(amount: number, reason: string): Promise<boolean> {
  try {
    const res = await apiClient.post<{ success: boolean }>('/skrimchat-coins/spend', { amount, reason });
    notify();
    return res.success;
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-coins/spend not ready. Returning local fallback.", err);
    return spendCoinsLocal(amount, reason);
  }
}

export function spendCoinsLocal(amount: number, reason: string): boolean {
  const amt = Math.round(amount);
  if (amt <= 0) return true;
  const current = getCoinsLocal();
  if (current < amt) return false;
  const next = current - amt;
  safeSet(COINS_KEY, next.toString());
  appendLog({ id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type: "spend", amount: amt, reason, timestamp: Date.now() });
  notify();
  return true;
}

// ── Score → coins ────────────────────────────────────────────────────
// Raw scores aren't comparable across games (a Quiz score of 8 and a
// Snake score of 4,500 can represent similarly strong play), so coins are
// awarded based on how close the score is to that game's typical "great
// session" ceiling, then scaled into the requested 10,000–50,000-coin
// range for a strong run. A so-so run still earns something, just less.
const GAME_SCORE_CEILING: Record<string, number> = {
  gilli: 1000,
  lagori: 1200,
  kancha: 3000,
  kabaddi: 400,
  snake: 5000,
  tictactoe: 100,
  ludo: 100,
  snakesladders: 100,
  truthdare: 200,
  quiz: 10,
  emoji: 50,
  mafia: 1000,
  wordchain: 100,
  bluffquiz: 100,
  bubbleshooter: 5000,
};

const MIN_COINS_PER_GAME = 500; // floor, so even a rough first attempt earns something
const MAX_COINS_PER_GAME = 50_000; // ceiling for a standout run, per the requested 10k–50k range

/** Converts a raw game score into a coin award, normalized against that
 *  game's typical ceiling so every game's "great session" lands in the
 *  same 10k–50k coin neighborhood regardless of how big its raw numbers
 *  run. Unknown game IDs fall back to a flat mid-range award. */
export function coinsForScore(gameId: string, score: number): number {
  const ceiling = GAME_SCORE_CEILING[gameId];
  if (!ceiling || score <= 0) return MIN_COINS_PER_GAME;
  const ratio = Math.min(1, score / ceiling);
  const coins = MIN_COINS_PER_GAME + ratio * (MAX_COINS_PER_GAME - MIN_COINS_PER_GAME);
  return Math.round(coins);
}
