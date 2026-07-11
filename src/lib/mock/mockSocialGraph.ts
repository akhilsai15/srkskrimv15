import { useState, useEffect } from 'react';
import { mockUsers } from './mockData';
import { useSignalStore } from '../../store/signalStore';
import { apiClient } from '../apiClient';

function normalizeUsername(u: string): string {
  return (u || '').replace(/^@/, '');
}

export async function getMessageRequests(): Promise<any[]> {
  try {
    return await apiClient.get<any[]>('/skrimchat-social-graph/message-requests');
  } catch (err) {
    console.warn("TODO: Real backend GET /skrimchat-social-graph/message-requests not ready yet. Returning stub promise.", err);
    const data = localStorage.getItem('skrimchat_msg_requests');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveMessageRequests(arr: any[]): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/message-requests', { requests: arr });
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-social-graph/message-requests not ready.", err);
  }
  localStorage.setItem('skrimchat_msg_requests', JSON.stringify(arr));
  window.dispatchEvent(new Event('skrimchat_requests_updated'));
}

export async function hasSentRequest(fromUsername: string, targetUsername: string): Promise<boolean> {
  try {
    const res = await apiClient.get<{ sent: boolean }>(`/skrimchat-social-graph/message-requests/check?from=${fromUsername}&to=${targetUsername}`);
    return res.sent;
  } catch (err) {
    console.warn("TODO: Real backend check endpoint not ready.", err);
    const requests = await getMessageRequests();
    return requests.some((r: any) => r.fromUsername === fromUsername && r.targetUsername === targetUsername);
  }
}

export async function sendRequest(fromUsername: string, targetUsername: string, message: string = "Hey! Let's connect.", fromAvatar?: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/message-requests/send', { fromUsername, targetUsername, message });
  } catch (err) {
    console.warn("TODO: Real backend POST sendRequest not ready.", err);
    throw err;
  }
  const requests = await getMessageRequests();
  if (!requests.some((r: any) => r.fromUsername === fromUsername && r.targetUsername === targetUsername)) {
    requests.push({
      id: Date.now().toString(),
      fromUsername,
      targetUsername,
      message,
      timestamp: Date.now(),
      status: "pending",
      fromAvatar: fromAvatar || `https://i.pravatar.cc/150?u=${fromUsername}`
    });
    await saveMessageRequests(requests);
  }
}

export async function acceptRequest(requestId: string): Promise<void> {
  try {
    await apiClient.post(`/skrimchat-social-graph/message-requests/accept/${requestId}`);
  } catch (err) {
    console.warn("TODO: Real backend acceptRequest not ready.", err);
    throw err;
  }
  let requests = await getMessageRequests();
  const request = requests.find((r: any) => r.id === requestId);
  if (request) {
     requests = requests.filter((r: any) => r.id !== requestId);
     await saveMessageRequests(requests);
     
     await followUser(request.fromUsername);
     await followUser(request.targetUsername);
     const followers = await getFollowersArray();
     if (!followers.includes(request.fromUsername)) {
        followers.push(request.fromUsername);
        await saveFollowersArray(followers);
     }
     window.dispatchEvent(new Event('skrimchat_social_graph_updated'));

     const storedChatsStr = localStorage.getItem('skrimchat_custom_chats');
     const customChats = storedChatsStr ? JSON.parse(storedChatsStr) : {};
     const chatKey = request.fromUsername.replace('@', '');
     if (!customChats[chatKey]) customChats[chatKey] = [];
     customChats[chatKey].push({
        id: Date.now().toString(),
        text: request.message,
        sender: request.fromUsername,
        timestamp: Date.now()
     });
     localStorage.setItem('skrimchat_custom_chats', JSON.stringify(customChats));
  }
}

export async function declineRequest(requestId: string): Promise<void> {
  try {
    await apiClient.post(`/skrimchat-social-graph/message-requests/decline/${requestId}`);
  } catch (err) {
    console.warn("TODO: Real backend declineRequest not ready.", err);
    throw err;
  }
  let requests = await getMessageRequests();
  requests = requests.filter((r: any) => r.id !== requestId);
  await saveMessageRequests(requests);
}

export async function getFollowingArray(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/following');
  } catch (err) {
    console.warn("TODO: Real backend GET /skrimchat-social-graph/following not ready yet. Returning stub promise.", err);
    const data = localStorage.getItem('skrimchat_following');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveFollowingArray(arr: string[]): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/following', { following: arr });
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-social-graph/following not ready.", err);
  }
  localStorage.setItem('skrimchat_following', JSON.stringify(arr));
}

export async function getFollowersArray(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/followers');
  } catch (err) {
    console.warn("TODO: Real backend GET /skrimchat-social-graph/followers not ready yet. Returning stub promise.", err);
    const data = localStorage.getItem('skrimchat_followers');
    return data ? JSON.parse(data) : [];
  }
}

export async function saveFollowersArray(arr: string[]): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/followers', { followers: arr });
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-social-graph/followers not ready.", err);
  }
  localStorage.setItem('skrimchat_followers', JSON.stringify(arr));
}

export async function getUserCounts(): Promise<Record<string, {followers: number, following: number}>> {
  try {
    return await apiClient.get<Record<string, {followers: number, following: number}>>('/skrimchat-social-graph/counts');
  } catch (err) {
    console.warn("TODO: Real backend GET /skrimchat-social-graph/counts not ready.", err);
    const data = localStorage.getItem('skrimchat_user_counts');
    return data ? JSON.parse(data) : {};
  }
}

export async function saveUserCounts(counts: Record<string, {followers: number, following: number}>): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/counts', { counts });
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-social-graph/counts not ready.", err);
  }
  localStorage.setItem('skrimchat_user_counts', JSON.stringify(counts));
}

export async function isFollowing(targetUsername: string): Promise<boolean> {
  const arr = await getFollowingArray();
  return arr.includes(targetUsername);
}

export async function isFollowedBy(targetUsername: string): Promise<boolean> {
  const arr = await getFollowersArray();
  return arr.includes(targetUsername);
}

export async function getFollowingList(): Promise<string[]> {
  return await getFollowingArray();
}

export async function getFollowersCount(targetUsername: string, initialCount: number = 0): Promise<number> {
  const counts = await getUserCounts();
  if (counts[targetUsername]?.followers !== undefined) {
    return counts[targetUsername].followers;
  }
  return initialCount;
}

export async function followUser(targetUsername: string, initialFollowers: number = 0): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/follow', { targetUsername });
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-social-graph/follow not ready.", err);
    throw err;
  }
  const arr = await getFollowingArray();
  if (!arr.includes(targetUsername)) {
    arr.push(targetUsername);
    await saveFollowingArray(arr);
    
    const counts = await getUserCounts();
    if (!counts[targetUsername]) {
      counts[targetUsername] = { followers: initialFollowers, following: 0 };
    }
    counts[targetUsername].followers += 1;
    await saveUserCounts(counts);
    
    updateCurrentUserFollowing(1);
    
    const userObj = mockUsers.find((u: any) => 
      u.username?.toLowerCase() === targetUsername.toLowerCase() || 
      u.handle?.toLowerCase() === targetUsername.toLowerCase() || 
      u.username?.toLowerCase().replace('@', '') === targetUsername.toLowerCase().replace('@', '')
    );
    const displayName = userObj?.displayName || targetUsername.replace('@', '');
    const avatar = userObj?.avatar || `https://i.pravatar.cc/150?u=${targetUsername}`;

    useSignalStore.getState().addSignal({
      type: 'follow',
      user: displayName,
      avatar: avatar,
      text: 'started following you',
      time: 'Just now',
    });
    
    window.dispatchEvent(new Event('skrimchat_social_graph_updated'));
  }
}

export async function unfollowUser(targetUsername: string, initialFollowers: number = 0): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/unfollow', { targetUsername });
  } catch (err) {
    console.warn("TODO: Real backend POST /skrimchat-social-graph/unfollow not ready.", err);
    throw err;
  }
  let arr = await getFollowingArray();
  if (arr.includes(targetUsername)) {
    arr = arr.filter(u => u !== targetUsername);
    await saveFollowingArray(arr);
    
    const counts = await getUserCounts();
    if (!counts[targetUsername]) {
      counts[targetUsername] = { followers: initialFollowers, following: 0 };
    }
    counts[targetUsername].followers = Math.max(0, counts[targetUsername].followers - 1);
    await saveUserCounts(counts);
    
    updateCurrentUserFollowing(-1);
    
    window.dispatchEvent(new Event('skrimchat_social_graph_updated'));
  }
}

function updateCurrentUserFollowing(delta: number) {
  const userStr = localStorage.getItem('skrimchat_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      user.following = Math.max(0, (user.following || 0) + delta);
      localStorage.setItem('skrimchat_user', JSON.stringify(user));
      window.dispatchEvent(new Event('skrimchat_user_updated'));
    } catch(e) {}
  }
}

export function useFollowStatus(targetUsername: string) {
  const [status, setStatus] = useState({
    following: false,
    followedBy: false
  });

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      const followingVal = await isFollowing(targetUsername);
      const followedByVal = await isFollowedBy(targetUsername);
      if (active) {
        setStatus({ following: followingVal, followedBy: followedByVal });
      }
    };
    fetchStatus();

    const handleUpdate = () => {
      fetchStatus();
    };
    window.addEventListener('skrimchat_social_graph_updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('skrimchat_social_graph_updated', handleUpdate);
    };
  }, [targetUsername]);

  return status;
}

export function useSocialCounts(targetUsername: string, initialFollowers: number, initialFollowing: number) {
  const [counts, setCounts] = useState({
    followers: initialFollowers,
    following: initialFollowing
  });

  useEffect(() => {
    let active = true;
    const fetchCounts = async () => {
      const fCount = await getFollowersCount(targetUsername, initialFollowers);
      if (active) {
        setCounts({ followers: fCount, following: initialFollowing });
      }
    };
    fetchCounts();

    const handleUpdate = () => {
      fetchCounts();
    };
    window.addEventListener('skrimchat_social_graph_updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('skrimchat_social_graph_updated', handleUpdate);
    };
  }, [targetUsername, initialFollowers, initialFollowing]);

  return counts;
}

// ─── PRIVATE ACCOUNT ────────────────────────────────────────────────────────
export async function isPrivateAccount(): Promise<boolean> {
  try {
    return await apiClient.get<boolean>('/skrimchat-social-graph/private');
  } catch (err) {
    console.warn("TODO: Real backend GET private not ready.", err);
    try { return JSON.parse(localStorage.getItem('skrimchat_private_account') || 'false'); } catch { return false; }
  }
}

export async function setPrivateAccount(val: boolean): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/private', { private: val });
  } catch (err) {
    console.warn("TODO: Real backend POST private not ready.", err);
  }
  localStorage.setItem('skrimchat_private_account', JSON.stringify(val));
  window.dispatchEvent(new Event('skrimchat_privacy_updated'));
}

// ─── FOLLOW REQUESTS ─────────────────────────────────────────────────────────
export async function getFollowRequests(): Promise<any[]> {
  try {
    return await apiClient.get<any[]>('/skrimchat-social-graph/follow-requests');
  } catch (err) {
    console.warn("TODO: Real backend GET follow-requests not ready.", err);
    try { return JSON.parse(localStorage.getItem('skrimchat_follow_requests') || '[]'); } catch { return []; }
  }
}

export async function sendFollowRequest(fromUsername: string, toUsername: string, fromAvatar?: string, fromDisplayName?: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/follow-requests', { fromUsername, toUsername });
  } catch (err) {
    console.warn("TODO: Real backend POST follow-requests not ready.", err);
    throw err;
  }
  const reqs = await getFollowRequests();
  if (!reqs.find((r: any) => r.fromUsername === fromUsername && r.toUsername === toUsername)) {
    reqs.push({ id: Date.now().toString(), fromUsername, toUsername, fromAvatar: fromAvatar || `https://i.pravatar.cc/150?u=${fromUsername}`, fromDisplayName: fromDisplayName || fromUsername, requestedAt: Date.now(), status: 'pending' });
    localStorage.setItem('skrimchat_follow_requests', JSON.stringify(reqs));
    window.dispatchEvent(new Event('skrimchat_follow_requests_updated'));
  }
}

export async function hasSentFollowRequest(fromUsername: string, toUsername: string): Promise<boolean> {
  const reqs = await getFollowRequests();
  return reqs.some((r: any) => r.fromUsername === fromUsername && r.toUsername === toUsername && r.status === 'pending');
}

export async function acceptFollowRequest(requestId: string): Promise<void> {
  try {
    await apiClient.post(`/skrimchat-social-graph/follow-requests/accept/${requestId}`);
  } catch (err) {
    console.warn("TODO: Real backend POST follow-requests/accept not ready.", err);
    throw err;
  }
  let reqs = await getFollowRequests();
  const req = reqs.find((r: any) => r.id === requestId);
  if (req) {
    reqs = reqs.filter((r: any) => r.id !== requestId);
    localStorage.setItem('skrimchat_follow_requests', JSON.stringify(reqs));
    const followers = await getFollowersArray();
    if (!followers.includes(req.fromUsername)) { followers.push(req.fromUsername); await saveFollowersArray(followers); }
    window.dispatchEvent(new Event('skrimchat_follow_requests_updated'));
    window.dispatchEvent(new Event('skrimchat_social_graph_updated'));
  }
}

export async function declineFollowRequest(requestId: string): Promise<void> {
  try {
    await apiClient.post(`/skrimchat-social-graph/follow-requests/decline/${requestId}`);
  } catch (err) {
    console.warn("TODO: Real backend POST follow-requests/decline not ready.", err);
    throw err;
  }
  let reqs = (await getFollowRequests()).filter((r: any) => r.id !== requestId);
  localStorage.setItem('skrimchat_follow_requests', JSON.stringify(reqs));
  window.dispatchEvent(new Event('skrimchat_follow_requests_updated'));
}

// ─── BLOCKED USERS ───────────────────────────────────────────────────────────
export async function getBlockedUsers(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/blocked');
  } catch (err) {
    console.warn("TODO: Real backend GET blocked not ready.", err);
    try { return JSON.parse(localStorage.getItem('skrimchat_blocked_users') || '[]'); } catch { return []; }
  }
}

export async function blockUser(username: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/block', { username });
  } catch (err) {
    console.warn("TODO: Real backend POST block not ready.", err);
    throw err;
  }
  const list = await getBlockedUsers();
  if (!list.includes(username)) { list.push(username); localStorage.setItem('skrimchat_blocked_users', JSON.stringify(list)); window.dispatchEvent(new Event('skrimchat_privacy_updated')); }
}

export async function unblockUser(username: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/unblock', { username });
  } catch (err) {
    console.warn("TODO: Real backend POST unblock not ready.", err);
    throw err;
  }
  const list = (await getBlockedUsers()).filter(u => u !== username);
  localStorage.setItem('skrimchat_blocked_users', JSON.stringify(list));
  window.dispatchEvent(new Event('skrimchat_privacy_updated'));
}

export async function isBlocked(username: string): Promise<boolean> {
  const list = await getBlockedUsers();
  return list.includes(username);
}

// ─── MUTED USERS ─────────────────────────────────────────────────────────────
export async function getMutedUsers(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/muted');
  } catch (err) {
    console.warn("TODO: Real backend GET muted not ready.", err);
    try { return JSON.parse(localStorage.getItem('skrimchat_muted_users') || '[]'); } catch { return []; }
  }
}

export async function muteUser(username: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/mute', { username });
  } catch (err) {
    console.warn("TODO: Real backend POST mute not ready.", err);
    throw err;
  }
  const list = await getMutedUsers();
  if (!list.includes(username)) { list.push(username); localStorage.setItem('skrimchat_muted_users', JSON.stringify(list)); window.dispatchEvent(new Event('skrimchat_privacy_updated')); }
}

export async function unmuteUser(username: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/unmute', { username });
  } catch (err) {
    console.warn("TODO: Real backend POST unmute not ready.", err);
    throw err;
  }
  const list = (await getMutedUsers()).filter(u => u !== username);
  localStorage.setItem('skrimchat_muted_users', JSON.stringify(list));
  window.dispatchEvent(new Event('skrimchat_privacy_updated'));
}

export async function isMuted(username: string): Promise<boolean> {
  const list = await getMutedUsers();
  return list.includes(username);
}

// ─── MUTUAL FOLLOWERS ────────────────────────────────────────────────────────
function getMockFollowersOf(username: string): string[] {
  const clean = normalizeUsername(username);
  const idx = mockUsers.findIndex(u => u.username === clean);
  if (idx === -1) return [];
  const len = mockUsers.length;
  const offsets = [1, 2, 4];
  return offsets.map(off => mockUsers[(idx + off) % len].username);
}

export interface MutualFollower {
  username: string;
  displayName: string;
  avatar: string;
}

export async function getMutualFollowers(targetUsername: string, currentUsername?: string): Promise<MutualFollower[]> {
  const target = normalizeUsername(targetUsername);
  const currentFollowing = (await getFollowingArray()).map(normalizeUsername);

  const mockFollowerUsernames = getMockFollowersOf(target);
  const sessionFollowers = (await getFollowersArray()).map(normalizeUsername);
  const allFollowersOfTarget = Array.from(new Set([...mockFollowerUsernames, ...sessionFollowers]));

  const mutualUsernames = allFollowersOfTarget.filter(u =>
    currentFollowing.includes(u) && u !== target && u !== normalizeUsername(currentUsername || '')
  );

  return mutualUsernames
    .map(u => mockUsers.find(mu => mu.username === u))
    .filter((u): u is typeof mockUsers[number] => !!u)
    .map(u => ({ username: u.username, displayName: u.displayName, avatar: u.avatar }));
}

// ─── PINNED POSTS ────────────────────────────────────────────────────────────
function pinnedKey(username: string): string {
  return `skrimchat_pinned_posts_${normalizeUsername(username)}`;
}

export async function getPinnedPostIds(username: string): Promise<string[]> {
  try {
    return await apiClient.get<string[]>(`/skrimchat-social-graph/pinned?username=${username}`);
  } catch (err) {
    console.warn("TODO: Real backend GET pinned not ready.", err);
    try { return JSON.parse(localStorage.getItem(pinnedKey(username)) || '[]'); } catch { return []; }
  }
}

export async function isPostPinned(username: string, postId: string): Promise<boolean> {
  const arr = await getPinnedPostIds(username);
  return arr.includes(postId);
}

export async function pinPost(username: string, postId: string, maxPins: number = 3): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/pinned/pin', { username, postId, maxPins });
  } catch (err) {
    console.warn("TODO: Real backend POST pin not ready.", err);
  }
  let ids = await getPinnedPostIds(username);
  if (ids.includes(postId)) return;
  ids = [postId, ...ids].slice(0, maxPins);
  localStorage.setItem(pinnedKey(username), JSON.stringify(ids));
  window.dispatchEvent(new Event('skrimchat_pinned_posts_updated'));
}

export async function unpinPost(username: string, postId: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/pinned/unpin', { username, postId });
  } catch (err) {
    console.warn("TODO: Real backend POST unpin not ready.", err);
  }
  const ids = (await getPinnedPostIds(username)).filter(id => id !== postId);
  localStorage.setItem(pinnedKey(username), JSON.stringify(ids));
  window.dispatchEvent(new Event('skrimchat_pinned_posts_updated'));
}

export async function togglePinPost(username: string, postId: string, maxPins: number = 3): Promise<void> {
  if (await isPostPinned(username, postId)) {
    await unpinPost(username, postId);
  } else {
    await pinPost(username, postId, maxPins);
  }
}

export async function sortWithPinnedFirst<T extends { id?: string }>(posts: T[], username: string): Promise<T[]> {
  const pinnedIds = await getPinnedPostIds(username);
  if (pinnedIds.length === 0) return posts;
  const pinnedSet = new Set(pinnedIds);
  const pinned = pinnedIds
    .map(id => posts.find(p => p.id === id))
    .filter((p): p is T => !!p);
  const rest = posts.filter(p => !p.id || !pinnedSet.has(p.id));
  return [...pinned, ...rest];
}

export function usePinnedPosts(username: string) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const fetchPinned = async () => {
      const ids = await getPinnedPostIds(username);
      if (active) setPinnedIds(ids);
    };
    fetchPinned();

    const handleUpdate = () => {
      fetchPinned();
    };
    window.addEventListener('skrimchat_pinned_posts_updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('skrimchat_pinned_posts_updated', handleUpdate);
    };
  }, [username]);

  return pinnedIds;
}

// ─── CLOSE FRIENDS ───────────────────────────────────────────────────────────
export async function getCloseFriends(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/close-friends');
  } catch (err) {
    console.warn("TODO: Real backend GET close-friends not ready.", err);
    try { return JSON.parse(localStorage.getItem('skrimchat_close_friends') || '[]'); } catch { return []; }
  }
}

export async function saveCloseFriends(arr: string[]): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/close-friends', { closeFriends: arr });
  } catch (err) {
    console.warn("TODO: Real backend POST close-friends not ready.", err);
  }
  localStorage.setItem('skrimchat_close_friends', JSON.stringify(arr));
  window.dispatchEvent(new Event('skrimchat_close_friends_updated'));
}

export async function isCloseFriend(username: string): Promise<boolean> {
  const list = await getCloseFriends();
  return list.includes(normalizeUsername(username));
}

export async function addCloseFriend(username: string): Promise<void> {
  const clean = normalizeUsername(username);
  const list = await getCloseFriends();
  if (!list.includes(clean)) {
    await saveCloseFriends([...list, clean]);
  }
}

export async function removeCloseFriend(username: string): Promise<void> {
  const clean = normalizeUsername(username);
  await saveCloseFriends((await getCloseFriends()).filter(u => u !== clean));
}

export async function toggleCloseFriend(username: string): Promise<void> {
  if (await isCloseFriend(username)) await removeCloseFriend(username);
  else await addCloseFriend(username);
}

export function useCloseFriends() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const fetchFriends = async () => {
      const friends = await getCloseFriends();
      if (active) setList(friends);
    };
    fetchFriends();

    const handleUpdate = () => {
      fetchFriends();
    };
    window.addEventListener('skrimchat_close_friends_updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('skrimchat_close_friends_updated', handleUpdate);
    };
  }, []);

  return list;
}

// ─── MULTIPLE LINK-IN-BIO ────────────────────────────────────────────────────
export interface ProfileLink {
  id: string;
  label: string;
  url: string;
}

export function getProfileLinks(user: any): ProfileLink[] {
  if (Array.isArray(user?.links) && user.links.length > 0) {
    return user.links.filter((l: any) => l && l.url);
  }
  if (user?.website) {
    return [{ id: 'legacy_website', label: '', url: user.website }];
  }
  return [];
}

// ─── PEOPLE ALSO FOLLOW ──────────────────────────────────────────────────────
export interface SocialRecommendation {
  username: string;
  displayName: string;
  avatar: string;
  mutualCount: number;
}

function getMockFollowingOf(username: string): string[] {
  const clean = normalizeUsername(username);
  const idx = mockUsers.findIndex(u => u.username === clean);
  if (idx === -1) return [];
  const len = mockUsers.length;
  return [1, 3, 5].map(off => mockUsers[(idx + off) % len].username);
}

export async function getPeopleAlsoFollow(
  targetUsername: string,
  currentUsername?: string
): Promise<SocialRecommendation[]> {
  const target = normalizeUsername(targetUsername);
  const currentFollowing = [
    ...(await getFollowingArray()).map(normalizeUsername),
    ...(currentUsername ? [normalizeUsername(currentUsername)] : []),
    target,
  ];

  const targetFollowers = Array.from(new Set([
    ...getMockFollowersOf(target),
    ...(await getFollowersArray()).map(normalizeUsername),
  ]));

  const candidateCounts: Record<string, number> = {};
  for (const follower of targetFollowers) {
    for (const followed of getMockFollowingOf(follower)) {
      if (!currentFollowing.includes(followed)) {
        candidateCounts[followed] = (candidateCounts[followed] || 0) + 1;
      }
    }
  }

  const myFollowing = (await getFollowingArray()).map(normalizeUsername);
  for (const followed of myFollowing) {
    for (const secondDegree of getMockFollowingOf(followed)) {
      if (!currentFollowing.includes(secondDegree)) {
        candidateCounts[secondDegree] = (candidateCounts[secondDegree] || 0) + 1;
      }
    }
  }

  return Object.entries(candidateCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([username, mutualCount]) => {
      const user = mockUsers.find(u => u.username === username);
      return {
        username,
        displayName: user?.displayName || username,
        avatar: user?.avatar || `https://i.pravatar.cc/150?u=${username}`,
        mutualCount,
      };
    });
}

// ─── KEYWORD FILTERS (comments & DMs) ────────────────────────────────────────
const KEYWORD_FILTER_KEY = 'skrimchat_keyword_filters';

export async function getKeywordFilters(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/keywords');
  } catch (err) {
    console.warn("TODO: Real backend GET keywords not ready.", err);
    try { return JSON.parse(localStorage.getItem(KEYWORD_FILTER_KEY) || '[]'); } catch { return []; }
  }
}

export async function saveKeywordFilters(words: string[]): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/keywords', { keywords: words });
  } catch (err) {
    console.warn("TODO: Real backend POST keywords not ready.", err);
  }
  localStorage.setItem(KEYWORD_FILTER_KEY, JSON.stringify(words));
  window.dispatchEvent(new Event('skrimchat_keyword_filters_updated'));
}

export async function addKeywordFilter(word: string): Promise<void> {
  const list = await getKeywordFilters();
  const clean = word.trim().toLowerCase();
  if (clean && !list.includes(clean)) {
    list.push(clean);
    await saveKeywordFilters(list);
  }
}

export async function removeKeywordFilter(word: string): Promise<void> {
  const list = (await getKeywordFilters()).filter(w => w !== word.toLowerCase());
  await saveKeywordFilters(list);
}

export async function containsFilteredKeyword(text: string): Promise<boolean> {
  const filters = await getKeywordFilters();
  if (!filters.length) return false;
  const lower = text.toLowerCase();
  return filters.some(w => lower.includes(w));
}

export function useKeywordFilters() {
  const [filters, setFilters] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const fetchKeywords = async () => {
      const words = await getKeywordFilters();
      if (active) setFilters(words);
    };
    fetchKeywords();

    const handle = () => fetchKeywords();
    window.addEventListener('skrimchat_keyword_filters_updated', handle);
    return () => {
      active = false;
      window.removeEventListener('skrimchat_keyword_filters_updated', handle);
    };
  }, []);
  return filters;
}

// ─── RESTRICT MODE (shadow-restrict) ─────────────────────────────────────────
const RESTRICTED_USERS_KEY = 'skrimchat_restricted_users';

export async function getRestrictedUsers(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/restricted');
  } catch (err) {
    console.warn("TODO: Real backend GET restricted not ready.", err);
    try { return JSON.parse(localStorage.getItem(RESTRICTED_USERS_KEY) || '[]'); } catch { return []; }
  }
}

export async function restrictUser(username: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/restricted', { username });
  } catch (err) {
    console.warn("TODO: Real backend POST restrict not ready.", err);
    throw err;
  }
  const list = await getRestrictedUsers();
  if (!list.includes(username)) {
    list.push(username);
    localStorage.setItem(RESTRICTED_USERS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('skrimchat_privacy_updated'));
  }
}

export async function unrestrictUser(username: string): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/unrestrict', { username });
  } catch (err) {
    console.warn("TODO: Real backend POST unrestrict not ready.", err);
    throw err;
  }
  const list = (await getRestrictedUsers()).filter(u => u !== username);
  localStorage.setItem(RESTRICTED_USERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('skrimchat_privacy_updated'));
}

export async function isRestricted(username: string): Promise<boolean> {
  const list = await getRestrictedUsers();
  return list.includes(username);
}

// ─── HIDDEN WORDS / SENSITIVE CONTENT ────────────────────────────────────────
const HIDDEN_WORDS_KEY = 'skrimchat_hidden_words';
const SENSITIVE_FILTER_KEY = 'skrimchat_sensitive_filter';

export async function getHiddenWords(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/skrimchat-social-graph/hidden-words');
  } catch (err) {
    console.warn("TODO: Real backend GET hidden-words not ready.", err);
    try { return JSON.parse(localStorage.getItem(HIDDEN_WORDS_KEY) || '[]'); } catch { return []; }
  }
}

export async function saveHiddenWords(words: string[]): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/hidden-words', { words });
  } catch (err) {
    console.warn("TODO: Real backend POST hidden-words not ready.", err);
  }
  localStorage.setItem(HIDDEN_WORDS_KEY, JSON.stringify(words));
  window.dispatchEvent(new Event('skrimchat_privacy_updated'));
}

export async function getSensitiveContentFilter(): Promise<boolean> {
  try {
    return await apiClient.get<boolean>('/skrimchat-social-graph/sensitive-filter');
  } catch (err) {
    console.warn("TODO: Real backend GET sensitive-filter not ready.", err);
    try { return JSON.parse(localStorage.getItem(SENSITIVE_FILTER_KEY) || 'false'); } catch { return false; }
  }
}

export async function setSensitiveContentFilter(val: boolean): Promise<void> {
  try {
    await apiClient.post('/skrimchat-social-graph/sensitive-filter', { filter: val });
  } catch (err) {
    console.warn("TODO: Real backend POST sensitive-filter not ready.", err);
  }
  localStorage.setItem(SENSITIVE_FILTER_KEY, JSON.stringify(val));
  window.dispatchEvent(new Event('skrimchat_privacy_updated'));
}

// ─── PER-POST COMMENT CONTROLS ────────────────────────────────────────────────
const POST_SETTINGS_KEY = 'skrimchat_post_settings';

export interface PostModerationSettings {
  commentsDisabled?: boolean;
  filteredWords?: string[];
}

export async function getPostModerationSettings(postId: string): Promise<PostModerationSettings> {
  try {
    return await apiClient.get<PostModerationSettings>(`/skrimchat-social-graph/post-settings/${postId}`);
  } catch (err) {
    console.warn("TODO: Real backend GET post-settings not ready.", err);
    try {
      const all = JSON.parse(localStorage.getItem(POST_SETTINGS_KEY) || '{}');
      return all[postId] || {};
    } catch { return {}; }
  }
}

export async function savePostModerationSettings(postId: string, settings: PostModerationSettings): Promise<void> {
  try {
    await apiClient.post(`/skrimchat-social-graph/post-settings/${postId}`, { settings });
  } catch (err) {
    console.warn("TODO: Real backend POST post-settings not ready.", err);
  }
  try {
    const all = JSON.parse(localStorage.getItem(POST_SETTINGS_KEY) || '{}');
    all[postId] = { ...all[postId], ...settings };
    localStorage.setItem(POST_SETTINGS_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event('skrimchat_post_settings_updated'));
  } catch {}
}
