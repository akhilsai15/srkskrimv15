import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Globe, Shield, UserX, VolumeX, Check, ChevronRight, AlertTriangle, Users, Filter, Eye, EyeOff, Ban, Plus, Trash2 } from 'lucide-react';
import {
  isPrivateAccount, setPrivateAccount,
  getBlockedUsers, unblockUser,
  getMutedUsers, unmuteUser,
  getFollowRequests, acceptFollowRequest, declineFollowRequest,
  getKeywordFilters, addKeywordFilter, removeKeywordFilter,
  getRestrictedUsers, unrestrictUser,
  getHiddenWords, saveHiddenWords, getSensitiveContentFilter, setSensitiveContentFilter,
} from '../lib/mock/mockSocialGraph';

interface Props {
  onClose: () => void;
}

type SubView = null | 'blocked' | 'muted' | 'follow_requests' | 'keyword_filters' | 'restricted' | 'hidden_words' | 'privacy_center';

export const PrivacySettingsSheet = ({ onClose }: Props) => {
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [keywordFilters, setKeywordFilters] = useState<string[]>([]);
  const [hiddenWords, setHiddenWords] = useState<string[]>([]);
  const [sensitiveFilter, setSensitiveFilter] = useState<boolean>(false);
  const [subView, setSubView] = useState<SubView>(null);
  const [toast, setToast] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newHiddenWord, setNewHiddenWord] = useState('');

  const refresh = async () => {
    try {
      const isPriv = await isPrivateAccount();
      const blocked = await getBlockedUsers();
      const muted = await getMutedUsers();
      const reqs = await getFollowRequests();
      const restricted = await getRestrictedUsers();
      const keywords = await getKeywordFilters();
      const hidden = await getHiddenWords();
      const sens = await getSensitiveContentFilter();

      setIsPrivate(isPriv);
      setBlockedUsers(blocked);
      setMutedUsers(muted);
      setFollowRequests(reqs);
      setRestrictedUsers(restricted);
      setKeywordFilters(keywords);
      setHiddenWords(hidden);
      setSensitiveFilter(sens);
    } catch (e) {
      console.error("Failed to load privacy settings", e);
    }
  };

  useEffect(() => {
    refresh();
    window.addEventListener('skrimchat_privacy_updated', refresh);
    window.addEventListener('skrimchat_follow_requests_updated', refresh);
    return () => {
      window.removeEventListener('skrimchat_privacy_updated', refresh);
      window.removeEventListener('skrimchat_follow_requests_updated', refresh);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handlePrivateToggle = async () => {
    const next = !isPrivate;
    try {
      await setPrivateAccount(next);
      setIsPrivate(next);
      showToast(next ? '🔒 Account set to Private' : '🌐 Account set to Public');
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnblock = async (username: string) => {
    try {
      await unblockUser(username);
      setBlockedUsers(prev => prev.filter(u => u !== username));
      showToast(`@${username} unblocked`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnmute = async (username: string) => {
    try {
      await unmuteUser(username);
      setMutedUsers(prev => prev.filter(u => u !== username));
      showToast(`@${username} unmuted`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await acceptFollowRequest(requestId);
      await refresh();
      showToast('Follow request accepted ✓');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineFollowRequest(requestId);
      await refresh();
      showToast('Follow request declined');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-[#141414] rounded-t-3xl z-[301] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 overflow-hidden"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-4 shrink-0" />

        {/* Header */}
        <div className="px-6 flex justify-between items-center pb-4 shrink-0 border-b border-white/5">
          <div className="flex items-center gap-2">
            {subView && (
              <button onClick={() => setSubView(null)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full mr-1 transition">
                <X className="w-4 h-4 text-white/60 rotate-180" style={{ transform: 'scaleX(-1)' }} />
              </button>
            )}
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#B026FF]" />
              {subView === 'blocked' ? 'Blocked Users'
                : subView === 'muted' ? 'Muted Users'
                : subView === 'follow_requests' ? 'Follow Requests'
                : subView === 'keyword_filters' ? 'Keyword Filters'
                : subView === 'restricted' ? 'Restricted Users'
                : subView === 'hidden_words' ? 'Hidden Words'
                : subView === 'privacy_center' ? 'Privacy Center'
                : 'Privacy & Safety'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 pb-10 flex flex-col gap-3">

          {/* ── MAIN VIEW ── */}
          {!subView && (
            <>
              {/* Private / Public Account */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#B026FF]/20 flex items-center justify-center shrink-0">
                      {isPrivate ? <Lock className="w-5 h-5 text-[#B026FF]" /> : <Globe className="w-5 h-5 text-[#B026FF]" />}
                    </div>
                    <div>
                      <p className="font-bold text-white">Private Account</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {isPrivate ? 'Only approved followers can see your posts' : 'Anyone can see your posts and follow you'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handlePrivateToggle}
                    className={`relative w-12 h-6 rounded-full transition-colors ${isPrivate ? 'bg-[#B026FF]' : 'bg-white/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${isPrivate ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Privacy Center Button */}
              <button
                onClick={() => setSubView('privacy_center')}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-[#B026FF]/10 to-pink-500/5 hover:from-[#B026FF]/20 hover:to-pink-500/10 rounded-2xl border border-[#B026FF]/25 transition group text-left shadow-[0_0_15px_rgba(176,38,255,0.05)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#B026FF]/20 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-[#B026FF]" />
                  </div>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      Privacy Center 
                      <span className="text-[10px] bg-[#B026FF]/35 text-white px-1.5 py-0.5 rounded-full font-medium tracking-wide">JIT</span>
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      See how we protect your microphone, camera, and location
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>

              {/* Sub-menu triggers */}
              <button
                onClick={() => setSubView('follow_requests')}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Follow Requests</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {followRequests.length > 0 ? `${followRequests.length} pending requests` : 'Manage who can follow you'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>

              <button
                onClick={() => setSubView('blocked')}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <UserX className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Blocked Users</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {blockedUsers.length > 0 ? `${blockedUsers.length} users blocked` : 'Manage blocked profiles'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>

              <button
                onClick={() => setSubView('muted')}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                    <VolumeX className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Muted Users</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {mutedUsers.length > 0 ? `${mutedUsers.length} users muted` : 'Mute posts/stories from accounts'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>

              <button
                onClick={() => setSubView('restricted')}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <Ban className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Restricted Users</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {restrictedUsers.length > 0 ? `${restrictedUsers.length} users restricted` : 'Restrict accounts quietly'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>

              <button
                onClick={() => setSubView('keyword_filters')}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Filter className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Keyword Filters</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {keywordFilters.length > 0 ? `${keywordFilters.length} filter keywords` : 'Block comments with custom words'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>

              <button
                onClick={() => setSubView('hidden_words')}
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <EyeOff className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Hidden Words</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      Sensitive filter & custom post-hiding words
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition" />
              </button>
            </>
          )}

          {/* ── BLOCKED USERS VIEW ── */}
          {subView === 'blocked' && (
            <>
              {blockedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <UserX className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white font-bold mb-1">No blocked users</p>
                  <p className="text-white/40 text-sm">When you block someone, they cannot see your profile</p>
                </div>
              ) : blockedUsers.map(username => (
                <div key={username} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <img
                    src={`https://i.pravatar.cc/150?u=${username}`}
                    alt={username}
                    className="w-11 h-11 rounded-full object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">@{username}</p>
                    <p className="text-white/40 text-xs">Blocked</p>
                  </div>
                  <button
                    onClick={() => handleUnblock(username)}
                    className="px-3 py-1.5 rounded-full bg-[#B026FF]/10 hover:bg-[#B026FF]/20 text-[#B026FF] text-xs font-bold border border-[#B026FF]/20 transition active:scale-95"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── MUTED USERS VIEW ── */}
          {subView === 'muted' && (
            <>
              {mutedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <VolumeX className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white font-bold mb-1">No muted users</p>
                  <p className="text-white/40 text-sm">You can mute accounts from their posts or profiles</p>
                </div>
              ) : mutedUsers.map(username => (
                <div key={username} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <img
                    src={`https://i.pravatar.cc/150?u=${username}`}
                    alt={username}
                    className="w-11 h-11 rounded-full object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">@{username}</p>
                    <p className="text-white/40 text-xs">Muted</p>
                  </div>
                  <button
                    onClick={() => handleUnmute(username)}
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition active:scale-95"
                  >
                    Unmute
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── KEYWORD FILTERS VIEW ── */}
          {subView === 'keyword_filters' && (
            <>
              <div className="flex gap-2 bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20 mb-1">
                <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-white/60 text-xs leading-relaxed">
                  Comments containing these words will be automatically hidden from your posts. Other users won't see them.
                </p>
              </div>

              {/* Add keyword input */}
              <div className="flex gap-2">
                <input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newKeyword.trim()) {
                      const trimmed = newKeyword.trim();
                      await addKeywordFilter(trimmed);
                      const updated = await getKeywordFilters();
                      setKeywordFilters(updated);
                      setNewKeyword('');
                      showToast('Keyword added');
                    }
                  }}
                  placeholder="Add a word or phrase…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-400/50"
                />
                <button
                  onClick={async () => {
                    if (!newKeyword.trim()) return;
                    const trimmed = newKeyword.trim();
                    await addKeywordFilter(trimmed);
                    const updated = await getKeywordFilters();
                    setKeywordFilters(updated);
                    setNewKeyword('');
                    showToast('Keyword added');
                  }}
                  className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center hover:bg-blue-500/40 transition"
                >
                  <Plus className="w-5 h-5 text-blue-400" />
                </button>
              </div>
              {keywordFilters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Filter className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white font-bold mb-1">No keyword filters</p>
                  <p className="text-white/40 text-sm">Add words above to hide matching content</p>
                </div>
              ) : keywordFilters.map(word => (
                <div key={word} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <p className="text-white font-semibold">{word}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await removeKeywordFilter(word);
                      const updated = await getKeywordFilters();
                      setKeywordFilters(updated);
                      showToast(`"${word}" removed`);
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/30 transition"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── RESTRICTED USERS VIEW ── */}
          {subView === 'restricted' && (
            <>
              <div className="flex gap-2 bg-yellow-500/10 rounded-2xl p-4 border border-yellow-500/20 mb-1">
                <Ban className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-white/60 text-xs leading-relaxed">
                  Restricted users can still see your posts, but their comments are only visible to them. They won't know they're restricted.
                </p>
              </div>
              {restrictedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Ban className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white font-bold mb-1">No restricted users</p>
                  <p className="text-white/40 text-sm">Restrict users from their profile or post comments</p>
                </div>
              ) : restrictedUsers.map(username => (
                <div key={username} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <img
                    src={`https://i.pravatar.cc/150?u=${username}`}
                    alt={username}
                    className="w-11 h-11 rounded-full object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">@{username}</p>
                    <p className="text-white/40 text-xs">Restricted · comments hidden from others</p>
                  </div>
                  <button
                    onClick={async () => {
                      await unrestrictUser(username);
                      const updated = await getRestrictedUsers();
                      setRestrictedUsers(updated);
                      showToast(`@${username} unrestricted`);
                    }}
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition active:scale-95"
                  >
                    Unrestrict
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── HIDDEN WORDS VIEW ── */}
          {subView === 'hidden_words' && (
            <>
              {/* Sensitive content toggle */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      {sensitiveFilter ? <EyeOff className="w-5 h-5 text-purple-400" /> : <Eye className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-white">Sensitive Content Filter</p>
                      <p className="text-white/40 text-xs mt-0.5">Auto-blur potentially sensitive posts</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !sensitiveFilter;
                      await setSensitiveContentFilter(next);
                      setSensitiveFilter(next);
                      showToast(next ? '🙈 Sensitive filter on' : '👁 Sensitive filter off');
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors ${sensitiveFilter ? 'bg-[#B026FF]' : 'bg-white/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${sensitiveFilter ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-1 pt-2">Custom Hidden Words</p>

              {/* Add word input */}
              <div className="flex gap-2">
                <input
                  value={newHiddenWord}
                  onChange={e => setNewHiddenWord(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newHiddenWord.trim()) {
                      const updated = [...hiddenWords, newHiddenWord.trim().toLowerCase()].filter((v, i, a) => a.indexOf(v) === i);
                      await saveHiddenWords(updated);
                      setHiddenWords(updated);
                      setNewHiddenWord('');
                      showToast('Hidden word added');
                    }
                  }}
                  placeholder="Add a word to hide…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-purple-400/50"
                />
                <button
                  onClick={async () => {
                    if (!newHiddenWord.trim()) return;
                    const updated = [...hiddenWords, newHiddenWord.trim().toLowerCase()].filter((v, i, a) => a.indexOf(v) === i);
                    await saveHiddenWords(updated);
                    setHiddenWords(updated);
                    setNewHiddenWord('');
                    showToast('Hidden word added');
                  }}
                  className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center hover:bg-purple-500/40 transition"
                >
                  <Plus className="w-5 h-5 text-purple-400" />
                </button>
              </div>

              {hiddenWords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <EyeOff className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white font-bold mb-1">No hidden words</p>
                  <p className="text-white/40 text-sm">Posts and comments with these words will be hidden</p>
                </div>
              ) : hiddenWords.map(word => (
                <div key={word} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <p className="text-white font-semibold">{word}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const updated = hiddenWords.filter(w => w !== word);
                      await saveHiddenWords(updated);
                      setHiddenWords(updated);
                      showToast(`"${word}" removed`);
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/30 transition"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </>
          )}


          {subView === 'follow_requests' && (
            <>
              {followRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white font-bold mb-1">No pending requests</p>
                  <p className="text-white/40 text-sm">Follow requests will appear here</p>
                </div>
              ) : followRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <img
                    src={req.fromAvatar || `https://i.pravatar.cc/150?u=${req.fromUsername || null}`}
                    alt={req.fromUsername}
                    className="w-11 h-11 rounded-full object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{req.fromDisplayName || req.fromUsername}</p>
                    <p className="text-white/40 text-xs">@{req.fromUsername} wants to follow you</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="w-8 h-8 rounded-full bg-[#B026FF]/20 border border-[#B026FF]/40 flex items-center justify-center hover:bg-[#B026FF]/40 transition active:scale-95"
                    >
                      <Check className="w-4 h-4 text-[#B026FF]" />
                    </button>
                    <button
                      onClick={() => handleDecline(req.id)}
                      className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition active:scale-95"
                    >
                      <X className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {subView === 'privacy_center' && (
            <div className="flex flex-col gap-4">
              <div className="bg-[#B026FF]/10 border border-[#B026FF]/20 rounded-2xl p-4 flex gap-3">
                <Shield className="w-5 h-5 text-[#B026FF] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-bold text-sm">Just-In-Time Philosophy</h4>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed">
                    We believe in zero trust and absolute control. Your device's sensitive resources (microphone, camera, location) are only requested when you actively trigger a feature. No background tracking, no pre-scanning, and immediate release.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Camera & Mic */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                    <span className="text-pink-400 font-bold text-sm">📷</span>
                  </div>
                  <div>
                    <h5 className="text-white font-bold text-sm">Camera & Microphone</h5>
                    <p className="text-white/55 text-xs mt-1 leading-relaxed">
                      Only activated when you start a video/audio call or record a Spark. When the call or recording ends (or the view is closed), all hardware tracks are stopped immediately to guarantee your mic and camera are off.
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <span className="text-green-400 font-bold text-sm">📍</span>
                  </div>
                  <div>
                    <h5 className="text-white font-bold text-sm">Location Services</h5>
                    <p className="text-white/55 text-xs mt-1 leading-relaxed">
                      We never trace your movements in the background. Your precise location is only requested when using active localized search (like Orbit). Updates stop instantly the moment you navigate away or close the screen.
                    </p>
                  </div>
                </div>

                {/* Gallery */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <span className="text-blue-400 font-bold text-sm">🖼️</span>
                  </div>
                  <div>
                    <h5 className="text-white font-bold text-sm">Native Media Gallery</h5>
                    <p className="text-white/55 text-xs mt-1 leading-relaxed">
                      Unlike other social apps, we do not require permission to "scan" your entire camera roll. Every file is chosen through your operating system's native picker, meaning the app only sees files you explicitly select.
                    </p>
                  </div>
                </div>

                {/* Temp Files */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <span className="text-purple-400 font-bold text-sm">🗑️</span>
                  </div>
                  <div>
                    <h5 className="text-white font-bold text-sm">Ephemeral Local Media</h5>
                    <p className="text-white/55 text-xs mt-1 leading-relaxed">
                      Any temporary files or memory blobs created during camera capture or voice recording are strictly short-lived. They are immediately released from memory once successfully uploaded to secure storage.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 px-5 py-2.5 rounded-full text-white text-sm font-semibold whitespace-nowrap"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};
