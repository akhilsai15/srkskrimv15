import { useState, useEffect } from 'react';
import { useSignalStore } from '../store/signalStore';
import { apiClient } from '../lib/apiClient';

// MOCK INITIAL DATA
export const INITIAL_COMMUNITIES = [
  {
    id: "c001",
    name: "SkrimGamers",
    initials: "SG",
    atmosphere: "nebula",
    members: 14200,
    description: "India's biggest gaming world",
    category: "Gaming",
    active: true,
    joined: false,
    location: "India",
    established: "Mar 2024",
    channelMode: "announcement",
    wikiText: "## Welcome to SkrimGamers!\n\nThis is India's largest gaming community. We host weekly tournaments, share tips, and celebrate wins together.\n\n### Rules\n- Be respectful\n- No spam\n- Keep it gaming-related\n\n### Weekly Events\nEvery Saturday at 8 PM IST we hold ranked tournaments across Valorant, BGMI, and more.",
  },
  {
    id: "c002",
    name: "BeatDrop",
    initials: "BD",
    atmosphere: "solar",
    members: 8900,
    description: "Music producers & listeners",
    category: "Music",
    active: true,
    joined: true,
    location: "Mumbai, India",
    established: "Jun 2024"
  },
  {
    id: "c003",
    name: "PixelCraft",
    initials: "PC",
    atmosphere: "ocean",
    members: 5400,
    description: "Digital art & creators",
    category: "Art",
    active: false,
    joined: false,
    location: "Bengaluru, India",
    established: "Sep 2024"
  },
  {
    id: "c004",
    name: "GrindMode",
    initials: "GM",
    atmosphere: "crimson",
    members: 21000,
    description: "Fitness & hustle culture",
    category: "Fitness",
    active: true,
    joined: true,
    paid: true,
    location: "Delhi, India",
    established: "Jan 2024"
  },
  {
    id: "c005",
    name: "InnerCircle",
    initials: "IC",
    atmosphere: "midnight",
    members: 340,
    description: "A private, invite-only space for close friends",
    category: "Lifestyle",
    active: true,
    joined: false,
    isPrivate: true,
    location: "India",
    established: "Feb 2025"
  }
];

export async function getCommunities(): Promise<any[]> {
  try {
    return await apiClient.get<any[]>('/skrimchat-world-members/communities');
  } catch (err) {
    console.warn("Failed to fetch communities via apiClient, returning local fallback.", err);
    const allStr = localStorage.getItem('worlds_all');
    let allComms = allStr ? JSON.parse(allStr) : INITIAL_COMMUNITIES;
    const joinedStr = localStorage.getItem('worlds_joined');
    const joinedIds = joinedStr ? JSON.parse(joinedStr) : allComms.filter((c: any) => c.joined).map((c: any) => c.id);
    return allComms.map((c: any) => ({
      ...c,
      joined: joinedIds.includes(c.id),
      members: c.members + (joinedIds.includes(c.id) && !c.joined ? 1 : 0)
    })).filter((c: any) => !c.isPrivate || joinedIds.includes(c.id));
  }
}

interface PendingRequest {
  id: string;
  name: string;
  requestedAt: number;
}

export function getPendingRequestsLocal(worldId: string): PendingRequest[] {
  const str = localStorage.getItem(`worlds_pending_${worldId}`);
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getPendingRequests(worldId: string): Promise<PendingRequest[]> {
  try {
    return await apiClient.get<PendingRequest[]>(`/skrimchat-world-members/${worldId}/pending`);
  } catch (err) {
    console.warn(`Failed to fetch pending requests for ${worldId}, using local fallback.`, err);
    return getPendingRequestsLocal(worldId);
  }
}

export function seedMockPendingRequests(worldId: string) {
  const names = ["Priya S.", "Rahul K."];
  const seeded: PendingRequest[] = names.map((name, i) => ({
    id: `mock_req_${worldId}_${i}`,
    name,
    requestedAt: Date.now() - (i + 1) * 1000 * 60 * 30,
  }));
  localStorage.setItem(`worlds_pending_${worldId}`, JSON.stringify(seeded));
  window.dispatchEvent(new Event('worlds_updated'));
}

export function hasRequestedJoinLocal(worldId: string): boolean {
  return getPendingRequestsLocal(worldId).some(r => r.id === 'currentUser');
}

export async function hasRequestedJoin(worldId: string): Promise<boolean> {
  try {
    const reqs = await getPendingRequests(worldId);
    return reqs.some(r => r.id === 'currentUser');
  } catch {
    return hasRequestedJoinLocal(worldId);
  }
}

export async function requestJoinPrivateWorld(worldId: string) {
  try {
    await apiClient.post('/skrimchat-world-members/request-join', { worldId });
  } catch (err) {
    console.warn("Failed to request-join via apiClient, running local fallback.", err);
    const list = getPendingRequestsLocal(worldId);
    if (!list.some(r => r.id === 'currentUser')) {
      list.push({ id: 'currentUser', name: 'You', requestedAt: Date.now() });
      localStorage.setItem(`worlds_pending_${worldId}`, JSON.stringify(list));
    }
  }
  window.dispatchEvent(new Event('worlds_updated'));
}

export async function cancelJoinRequest(worldId: string) {
  try {
    await apiClient.post('/skrimchat-world-members/cancel-request', { worldId });
  } catch (err) {
    console.warn("Failed to cancel-request via apiClient, running local fallback.", err);
    const list = getPendingRequestsLocal(worldId).filter(r => r.id !== 'currentUser');
    localStorage.setItem(`worlds_pending_${worldId}`, JSON.stringify(list));
  }
  window.dispatchEvent(new Event('worlds_updated'));
}

export async function approveJoinRequest(worldId: string, requesterId: string) {
  try {
    await apiClient.post(`/skrimchat-world-members/${worldId}/approve`, { requesterId });
  } catch (err) {
    console.warn(`Failed to approve join request via apiClient, running local fallback.`, err);
    const list = getPendingRequestsLocal(worldId).filter(r => r.id !== requesterId);
    localStorage.setItem(`worlds_pending_${worldId}`, JSON.stringify(list));

    if (requesterId === 'currentUser') {
      const joinedStr = localStorage.getItem('worlds_joined') || '[]';
      let arr: string[] = [];
      try { arr = JSON.parse(joinedStr); } catch {}
      if (!arr.includes(worldId)) {
        arr.push(worldId);
        localStorage.setItem('worlds_joined', JSON.stringify(arr));
        localStorage.setItem(`worlds_level_${worldId}`, 'explorer');
        localStorage.setItem(`worlds_joined_at_${worldId}`, Date.now().toString());
      }

      const comms = await getCommunities();
      const world = comms.find((c) => c.id === worldId);
      useSignalStore.getState().addSignal({
        type: 'world_join',
        user: world?.name || 'World Admin',
        avatar: '',
        text: `approved your request to join ${world?.name || 'the world'}! 🎉`,
        time: 'Just now',
        worldId,
      });
    } else {
      const allStr = localStorage.getItem('worlds_all');
      if (allStr) {
        try {
          const allArr = JSON.parse(allStr);
          if (Array.isArray(allArr)) {
            const updated = allArr.map((w: any) =>
              w.id === worldId ? { ...w, members: (w.members || 0) + 1 } : w
            );
            localStorage.setItem('worlds_all', JSON.stringify(updated));
          }
        } catch {}
      }
    }
  }
  window.dispatchEvent(new Event('worlds_updated'));
}

export async function denyJoinRequest(worldId: string, requesterId: string) {
  try {
    await apiClient.post(`/skrimchat-world-members/${worldId}/deny`, { requesterId });
  } catch (err) {
    console.warn(`Failed to deny join request via apiClient, running local fallback.`, err);
    const list = getPendingRequestsLocal(worldId).filter(r => r.id !== requesterId);
    localStorage.setItem(`worlds_pending_${worldId}`, JSON.stringify(list));

    if (requesterId === 'currentUser') {
      const comms = await getCommunities();
      const world = comms.find((c) => c.id === worldId);
      useSignalStore.getState().addSignal({
        type: 'world_join',
        user: world?.name || 'World Admin',
        avatar: '',
        text: `declined your request to join ${world?.name || 'the world'}`,
        time: 'Just now',
        worldId,
      });
    }
  }
  window.dispatchEvent(new Event('worlds_updated'));
}

export function useWorlds() {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCommunities();
      setCommunities(data);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load worlds");
      setLoading(false);
    }
  };

  useEffect(() => {
    handleUpdate();
    window.addEventListener('worlds_updated', handleUpdate);
    return () => window.removeEventListener('worlds_updated', handleUpdate);
  }, []);

  return { communities, loading, error, refresh: handleUpdate };
}

export function useWorldMembership(worldId: string) {
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);
  const [level, setLevel] = useState<string>('explorer');
  const [daysActive, setDaysActive] = useState(0);

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get<any>(`/skrimchat-world-members/${worldId}/status`);
      setJoined(res.joined);
      setPending(res.pending);
      setLevel(res.level || 'explorer');
      setDaysActive(res.daysActive || 0);
    } catch (err) {
      console.warn(`Failed to fetch membership status for ${worldId} via apiClient, using local fallback.`, err);
      const joinedStr = localStorage.getItem('worlds_joined') || '[]';
      let joinedIds: string[] = [];
      try { joinedIds = JSON.parse(joinedStr); } catch {}
      const isJoined = joinedIds.includes(worldId);
      setJoined(isJoined);
      
      setPending(hasRequestedJoinLocal(worldId));
      setLevel(localStorage.getItem(`worlds_level_${worldId}`) || 'explorer');

      const joinedAt = localStorage.getItem(`worlds_joined_at_${worldId}`);
      if (joinedAt) {
        const parsed = parseInt(joinedAt, 10);
        if (!isNaN(parsed)) {
          setDaysActive(Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
        }
      } else {
        setDaysActive(0);
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    window.addEventListener('worlds_updated', fetchStatus);
    return () => window.removeEventListener('worlds_updated', fetchStatus);
  }, [worldId]);

  const requestJoin = async () => {
    await requestJoinPrivateWorld(worldId);
    setPending(true);
  };

  const cancelRequest = async () => {
    await cancelJoinRequest(worldId);
    setPending(false);
  };

  const join = async () => {
    let isRejoin = false;
    try {
      const res = await apiClient.post<any>('/skrimchat-world-members/join', { worldId });
      isRejoin = res.isRejoin || false;
    } catch (err) {
      console.warn("Failed to join via apiClient, running local fallback.", err);
      const joinedStr = localStorage.getItem('worlds_joined') || '[]';
      let joinedIds: string[] = [];
      try { joinedIds = JSON.parse(joinedStr); } catch {}
      const prevStr = localStorage.getItem('worlds_prev_member') || '[]';
      let prevIds: string[] = [];
      try { prevIds = JSON.parse(prevStr); } catch {}
      isRejoin = prevIds.includes(worldId);

      if (!joinedIds.includes(worldId)) {
        joinedIds.push(worldId);
        localStorage.setItem('worlds_joined', JSON.stringify(joinedIds));
        if (!isRejoin) {
          localStorage.setItem(`worlds_level_${worldId}`, 'explorer');
          localStorage.setItem(`worlds_joined_at_${worldId}`, Date.now().toString());
        }
      }
    }
    setJoined(true);
    window.dispatchEvent(new Event('worlds_updated'));
    return isRejoin;
  };

  const leave = async () => {
    try {
      await apiClient.post('/skrimchat-world-members/leave', { worldId });
    } catch (err) {
      console.warn("Failed to leave via apiClient, running local fallback.", err);
      const joinedStr = localStorage.getItem('worlds_joined') || '[]';
      let joinedIds: string[] = [];
      try { joinedIds = JSON.parse(joinedStr); } catch {}
      joinedIds = joinedIds.filter((id) => id !== worldId);
      localStorage.setItem('worlds_joined', JSON.stringify(joinedIds));

      const prevStr = localStorage.getItem('worlds_prev_member') || '[]';
      let prevIds: string[] = [];
      try { prevIds = JSON.parse(prevStr); } catch {}
      if (!prevIds.includes(worldId)) {
        prevIds.push(worldId);
        localStorage.setItem('worlds_prev_member', JSON.stringify(prevIds));
      }
    }
    setJoined(false);
    window.dispatchEvent(new Event('worlds_updated'));
  };

  const deleteWorld = async () => {
    try {
      await apiClient.delete(`/skrimchat-world-members/${worldId}`);
    } catch (err) {
      console.warn("Failed to delete world via apiClient, running local fallback.", err);
      const allStr = localStorage.getItem('worlds_all');
      if (allStr) {
        try {
          const allArr = JSON.parse(allStr);
          if (Array.isArray(allArr)) {
            localStorage.setItem('worlds_all', JSON.stringify(allArr.filter((c: any) => c.id !== worldId)));
          }
        } catch {}
      }
      let joinedIds = JSON.parse(localStorage.getItem('worlds_joined') || '[]');
      joinedIds = joinedIds.filter((id: string) => id !== worldId);
      localStorage.setItem('worlds_joined', JSON.stringify(joinedIds));

      let prevIds = JSON.parse(localStorage.getItem('worlds_prev_member') || '[]');
      prevIds = prevIds.filter((id: string) => id !== worldId);
      localStorage.setItem('worlds_prev_member', JSON.stringify(prevIds));

      localStorage.removeItem(`worlds_level_${worldId}`);
      localStorage.removeItem(`worlds_joined_at_${worldId}`);
    }
    setJoined(false);
    window.dispatchEvent(new Event('worlds_updated'));
  };

  return { joined, join, leave, deleteWorld, level, daysActive, pending, requestJoin, cancelRequest };
}
