import { useState, useEffect, useCallback, useRef } from 'react';
import { mockOrbitUsers, OrbitUser, MoodStatus, IcebreakerType, getOrbitUsersAsync, updatePresenceAsync } from '../lib/mock/mockOrbit';
import { haversineDistanceKm, destinationPoint } from '../lib/geo';
import { requestCurrentPosition, LocationPermissionStatus } from '../lib/permissions/locationPermission';

export type RadiusKm = 1 | 5 | 10 | 25 | 50;
export type PresenceDuration = '15m' | '1h' | '3h' | 'always';
export type AgeFilter = '18-25' | '25-35' | '35-45' | 'all';
export type FemaleSafetyMode = 'off' | 'women_only' | 'verified_only' | 'nobody_first';

export type RequestStatus = 'none' | 'sent' | 'received' | 'accepted' | 'declined';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

interface PendingRequest {
  userId: string;
  type: IcebreakerType;
  direction: 'sent' | 'received';
  status: RequestStatus;
  createdAt: number;
}

const DAILY_REQUEST_LIMIT_FREE = 10;

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
    // ignore — storage disabled or quota exceeded
  }
}

function safeParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getRequests(): PendingRequest[] {
  return safeParse<PendingRequest[]>(safeGet('orbit_requests'), []);
}

function setRequests(reqs: PendingRequest[]) {
  safeSet('orbit_requests', JSON.stringify(reqs));
  window.dispatchEvent(new Event('orbit_updated'));
}

function getAccepted(): string[] {
  return safeParse<string[]>(safeGet('orbit_accepted'), []);
}

function setAccepted(ids: string[]) {
  safeSet('orbit_accepted', JSON.stringify(ids));
  window.dispatchEvent(new Event('orbit_updated'));
}

function getDailyCount(): number {
  const key = safeGet('orbit_request_count_date');
  const count = parseInt(safeGet('orbit_request_count') || '0', 10);
  if (key !== todayKey()) return 0;
  return isNaN(count) ? 0 : count;
}

function incrementDailyCount() {
  safeSet('orbit_request_count_date', todayKey());
  safeSet('orbit_request_count', String(getDailyCount() + 1));
}

export interface OrbitSettings {
  radiusKm: RadiusKm;
  presence: PresenceDuration;
  mood: MoodStatus;
  ageFilter: AgeFilter;
  femaleSafetyMode: FemaleSafetyMode;
  isVerified: boolean;
}

const DEFAULT_SETTINGS: OrbitSettings = {
  radiusKm: 10,
  presence: '1h',
  mood: 'want_to_chat',
  ageFilter: 'all',
  femaleSafetyMode: 'off',
  isVerified: false,
};

function getSettings(): OrbitSettings {
  return safeParse<OrbitSettings>(safeGet('orbit_settings'), DEFAULT_SETTINGS);
}

function setSettingsStorage(s: OrbitSettings) {
  safeSet('orbit_settings', JSON.stringify(s));
  window.dispatchEvent(new Event('orbit_updated'));
}

/** Main hook: orbit user list, filtered by current settings, plus request/accept actions. */
export function useOrbit() {
  const [settings, setSettingsState] = useState<OrbitSettings>(() => getSettings());
  const [requests, setRequestsState] = useState<PendingRequest[]>(() => getRequests());
  const [accepted, setAcceptedState] = useState<string[]>(() => getAccepted());
  const [dailyCount, setDailyCount] = useState<number>(() => getDailyCount());

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [users, setUsers] = useState<OrbitUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await getOrbitUsersAsync();
      setUsers(u || []);
    } catch (e: any) {
      console.error("Failed to fetch orbit users", e);
      setError(e.message || "Failed to load Orbit network");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activeRequestRef = useRef<(() => void) | null>(null);

  const requestLocation = useCallback(() => {
    if (activeRequestRef.current) {
      activeRequestRef.current();
    }
    setLocationStatus('requesting');
    const cleanup = requestCurrentPosition(
      (coordsData) => {
        setCoords(coordsData);
        setLocationStatus('granted');
      },
      (status) => {
        setLocationStatus(status);
      }
    );
    activeRequestRef.current = cleanup;
  }, []);

  // Stop updates and cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current();
      }
    };
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, coords]);

  useEffect(() => {
    const handle = () => {
      setSettingsState(getSettings());
      setRequestsState(getRequests());
      setAcceptedState(getAccepted());
      setDailyCount(getDailyCount());
    };
    window.addEventListener('orbit_updated', handle);
    return () => window.removeEventListener('orbit_updated', handle);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<OrbitSettings>) => {
    const next = { ...getSettings(), ...patch };
    setSettingsStorage(next);
    if (patch.mood || patch.presence) {
      await updatePresenceAsync(next.mood, next.presence);
    }
    await fetchUsers();
  }, [fetchUsers]);

  // Filter mock users by radius, age, and female-safety mode.
  // When we have a real device location, distance is computed with genuine
  // haversine math against each user's location (anchored relative to the
  // real device position + their stored bearing/distance). Without location
  // permission, we fall back to the static mock distanceKm so the screen
  // still works.
  const usersWithDistance = users.map((u) => {
    if (coords) {
      const userPoint = destinationPoint(coords.lat, coords.lon, u.bearingDeg, u.distanceKm);
      const liveDistanceKm = haversineDistanceKm(coords.lat, coords.lon, userPoint.lat, userPoint.lon);
      return { ...u, distanceKm: parseFloat(liveDistanceKm.toFixed(1)) };
    }
    return u;
  });

  const visibleUsers: OrbitUser[] = usersWithDistance.filter((u) => {
    if (u.distanceKm > settings.radiusKm) return false;
    if (settings.ageFilter !== 'all') {
      const [min, max] = settings.ageFilter.split('-').map(Number);
      if (u.age < min || u.age > max) return false;
    }
    if (settings.femaleSafetyMode === 'women_only' && u.genderForFilter !== 'female') return false;
    if (settings.femaleSafetyMode === 'verified_only' && !u.isVerified) return false;
    return u.mood !== 'invisible';
  });

  const requestStatusFor = (userId: string): RequestStatus => {
    if (accepted.includes(userId)) return 'accepted';
    const req = requests.find((r) => r.userId === userId);
    return req ? req.status : 'none';
  };

  const canSendRequest = dailyCount < DAILY_REQUEST_LIMIT_FREE || settings.isVerified;
  const requestsRemaining = Math.max(0, DAILY_REQUEST_LIMIT_FREE - dailyCount);

  const sendRequest = (userId: string, type: IcebreakerType) => {
    if (!canSendRequest) return false;
    const reqs = getRequests().filter((r) => r.userId !== userId);
    reqs.push({ userId, type, direction: 'sent', status: 'sent', createdAt: Date.now() });
    setRequests(reqs);
    incrementDailyCount();
    setDailyCount(getDailyCount());

    // Mock auto-response: the other user "accepts" after a short delay most of the time.
    const willAccept = Math.random() > 0.25;
    setTimeout(() => {
      if (willAccept) {
        const ids = getAccepted();
        if (!ids.includes(userId)) {
          ids.push(userId);
          setAccepted(ids);
        }
        const updated = getRequests().map((r) =>
          r.userId === userId ? { ...r, status: 'accepted' as RequestStatus } : r
        );
        setRequests(updated);
      } else {
        const updated = getRequests().map((r) =>
          r.userId === userId ? { ...r, status: 'declined' as RequestStatus } : r
        );
        setRequests(updated);
      }
    }, 2200);

    return true;
  };

  const acceptRequest = (userId: string) => {
    const ids = getAccepted();
    if (!ids.includes(userId)) {
      ids.push(userId);
      setAccepted(ids);
    }
    const updated = getRequests().map((r) =>
      r.userId === userId ? { ...r, status: 'accepted' as RequestStatus } : r
    );
    setRequests(updated);
  };

  const declineRequest = (userId: string) => {
    const updated = getRequests().map((r) =>
      r.userId === userId ? { ...r, status: 'declined' as RequestStatus } : r
    );
    setRequests(updated);
  };

  return {
    settings,
    updateSettings,
    visibleUsers,
    requestStatusFor,
    sendRequest,
    acceptRequest,
    declineRequest,
    canSendRequest,
    requestsRemaining,
    dailyLimit: DAILY_REQUEST_LIMIT_FREE,
    locationStatus,
    requestLocation,
    isLoading,
    error,
  };
}
