import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Music,
  Play,
  Pause,
  Disc,
  Volume2,
  Heart,
  Flame,
  Globe,
  Users,
  Rocket,
  Sparkles,
  Check,
  ChevronRight,
  UserPlus,
  UserCheck,
  Trophy,
  Dices,
  Gamepad2,
  TrendingUp,
} from "lucide-react";
import { isFollowing, followUser, unfollowUser } from "../lib/mock/mockSocialGraph";
import { mockUsers } from "../lib/mock/mockData";
import { CaptionWithHashtags } from "./CaptionWithHashtags";

interface PreSearchBentoGridProps {
  allVibes: any[];
  allWorlds: any[];
  loading: boolean;
  onOpenRoom: (room: any) => void;
  onStartSurprise: () => void;
  onSeeAllTrending: () => void;
}

// Format number (e.g. 12000 -> 12K)
const formatCount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(".0", "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(".0", "") + "K";
  return num;
};

// Shimmer card placeholder
function ShimmerCard({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-neutral-900/40 border border-white/5 backdrop-blur-md ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function PreSearchBentoGrid({
  allVibes,
  allWorlds,
  loading,
  onOpenRoom,
  onStartSurprise,
  onSeeAllTrending,
}: PreSearchBentoGridProps) {
  const navigate = useNavigate();

  // Music Player state
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [isPlayingTrack, setIsPlayingTrack] = useState(false);
  const [trackProgress, setTrackProgress] = useState(30);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Dice roll state
  const [isRolling, setIsRolling] = useState(false);

  // Follow states for Rising Creators (to force re-render locally)
  const [followToggleState, setFollowToggleState] = useState<Record<string, boolean>>({});

  // Clean username helper
  const getCleanUsername = (handle: string) => handle.replace("@", "");

  // Tracks extracted from the actual vibe audio data
  const tracks = React.useMemo(() => {
    if (!allVibes || allVibes.length === 0) return [];
    return allVibes
      .filter((v) => v.audio)
      .map((v) => ({
        id: v.id,
        title: v.audio.includes("Original Audio")
          ? `${v.user}'s Beat`
          : v.audio.split("·")[0] || "Cyber Rhythm",
        artist: v.user,
        avatar: v.avatar || `https://picsum.photos/100/100?seed=${v.user}`,
        vibeId: v.id,
      }))
      .slice(0, 4);
  }, [allVibes]);

  // Featured vibe (#1 trending)
  const featuredVibe = React.useMemo(() => {
    if (!allVibes || allVibes.length === 0) return null;
    return [...allVibes].sort((a, b) => (b.pulseCount || 0) - (a.pulseCount || 0))[0];
  }, [allVibes]);

  // Secondary vibe (#2 trending)
  const secondaryVibe = React.useMemo(() => {
    if (!allVibes || allVibes.length < 2) return null;
    return [...allVibes].sort((a, b) => (b.pulseCount || 0) - (a.pulseCount || 0))[1];
  }, [allVibes]);

  // Popular worlds
  const popularWorlds = React.useMemo(() => {
    if (!allWorlds || allWorlds.length === 0) return [];
    return [...allWorlds].sort((a, b) => (b.members || 0) - (a.members || 0)).slice(0, 3);
  }, [allWorlds]);

  // Rising creators loaded asynchronously
  const [asyncCreators, setAsyncCreators] = useState<any[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingCreators(true);
    const load = async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (active) {
        const languages = ["Telugu", "Hindi", "Tamil", "English"];
        const regions = ["Andhra", "Maharashtra", "Tamil Nadu", "Karnataka"];
        const mapped = mockUsers.slice(0, 6).map((u, i) => ({
          ...u,
          name: u.displayName,
          handle: `@${u.username}`,
          creatorLanguage: languages[i % languages.length],
          creatorRegion: regions[i % regions.length],
          followers: 14500 + i * 3200,
        }));
        setAsyncCreators(mapped);
        setLoadingCreators(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  // Track progress simulator
  useEffect(() => {
    if (isPlayingTrack) {
      progressInterval.current = setInterval(() => {
        setTrackProgress((p) => (p >= 100 ? 0 : p + 2));
      }, 800);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlayingTrack]);

  // Dice roll simulation
  const handleRollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    setTimeout(() => {
      setIsRolling(false);
      onStartSurprise();
    }, 800);
  };

  const handleFollowClick = (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    const isCurrentlyFollowing = isFollowing(username);
    if (isCurrentlyFollowing) {
      unfollowUser(username);
      setFollowToggleState((prev) => ({ ...prev, [username]: false }));
    } else {
      followUser(username);
      setFollowToggleState((prev) => ({ ...prev, [username]: true }));
    }
  };

  if (loading || !featuredVibe || tracks.length === 0) {
    return (
      <div className="px-4 pb-12 grid grid-cols-2 gap-4">
        <ShimmerCard className="col-span-2 h-[340px]" />
        <ShimmerCard className="col-span-2 h-[180px]" />
        <ShimmerCard className="col-span-1 h-[260px]" />
        <ShimmerCard className="col-span-1 h-[120px]" />
        <ShimmerCard className="col-span-1 h-[120px]" />
        <ShimmerCard className="col-span-2 h-[150px]" />
        <ShimmerCard className="col-span-1 h-[140px]" />
        <ShimmerCard className="col-span-1 h-[140px]" />
      </div>
    );
  }

  const currentTrack = tracks[activeTrackIndex];

  return (
    <div className="px-4 pb-12 flex flex-col gap-4 animate-[fadeIn_0.4s_ease-out]">
      {/* Bento Grid Container */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* CARD 1: FEATURED HOT VIBE (2x2) */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
          onClick={() => navigate(`/vibes?id=${featuredVibe.id}`)}
          className="col-span-2 row-span-2 aspect-square md:aspect-video rounded-3xl overflow-hidden bg-neutral-900/60 border border-white/5 hover:border-[#00F0FF]/30 relative group cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col"
          id="featured-vibe-card"
        >
          {/* Background/Thumbnail */}
          <div className="absolute inset-0 z-0">
            {featuredVibe.videoImageHover ? (
              <video
                src={featuredVibe.videoImageHover}
                poster={featuredVibe.avatar}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-85 group-hover:scale-[1.03] transition-all duration-500 pointer-events-none"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={featuredVibe.avatar}
                alt="Vibe"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-85 group-hover:scale-[1.03] transition-all duration-500"
              />
            )}
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-[#B026FF]/10" />
          </div>

          {/* Top Row - Status Badges */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-[#00F0FF]/30 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              <span className="text-[10px] animate-pulse">🔥</span>
              <span className="text-[#00F0FF] text-[9px] font-black uppercase tracking-widest">
                HOT VIBE
              </span>
            </div>
            <div className="flex items-center gap-1 bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full">
              <span className="text-[10px] text-pink-500 animate-bounce">⚡</span>
              <span className="text-white text-[10px] font-bold">
                {formatCount(featuredVibe.pulseCount || 0)}
              </span>
            </div>
          </div>

          {/* Bottom Card details */}
          <div className="mt-auto p-5 relative z-10 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <img
                src={featuredVibe.avatar}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-[#B026FF]/40 object-cover bg-black/50 shadow-[0_0_10px_rgba(176,38,255,0.2)]"
              />
              <div className="flex flex-col">
                <span className="text-white font-bold text-xs tracking-tight">
                  {featuredVibe.user}
                </span>
                <span className="text-white/50 text-[9px]">{featuredVibe.handle}</span>
              </div>
            </div>

            <CaptionWithHashtags
              caption={featuredVibe.caption}
              className="text-white text-sm md:text-base font-medium leading-snug line-clamp-2 drop-shadow-md"
            />

            {/* Play Overlay Signal */}
            <div className="flex items-center gap-1.5 text-[#00F0FF] text-[10px] font-bold mt-1 uppercase tracking-wider">
              <span>View Original Vibe</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Subtle bottom glass glow */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B026FF] via-[#00F0FF] to-transparent opacity-40" />
        </motion.div>

        {/* CARD 2: TRENDING AUDIO TRACKS (2x1) - FUTURISTIC MUSIC PLAYER */}
        <div
          className="col-span-2 rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-[#B026FF]/30 p-4 relative overflow-hidden flex flex-col gap-3 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
          id="trending-audio-card"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#B026FF]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Card Title Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Music className="w-4 h-4 text-[#B026FF]" />
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                Trending Audio
              </h3>
            </div>
            <span className="text-[9px] font-bold text-[#B026FF] bg-[#B026FF]/10 px-2 py-0.5 rounded-full">
              4 Tracks Active
            </span>
          </div>

          {/* Player Core View */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl relative z-10">
            {/* Spinning Album Art / Vinyl */}
            <div className="relative shrink-0">
              <motion.div
                animate={{ rotate: isPlayingTrack ? 360 : 0 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="w-12 h-12 rounded-full border-2 border-black bg-black shadow-lg relative flex items-center justify-center overflow-hidden"
              >
                <img
                  src={currentTrack?.avatar}
                  alt="Track cover"
                  className="w-full h-full object-cover opacity-70"
                />
                {/* Vinyl Grooves effect */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,_transparent_30%,_rgba(0,0,0,0.8)_80%)] mix-blend-overlay" />
                {/* Center hole */}
                <div className="absolute w-3 h-3 bg-[#0A0A0A] rounded-full border border-white/20 flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#00F0FF] rounded-full" />
                </div>
              </motion.div>
              {/* Floating musical note */}
              {isPlayingTrack && (
                <span className="absolute -top-1 -right-1 text-xs animate-bounce">🎵</span>
              )}
            </div>

            {/* Title / Controls */}
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-white text-xs font-black truncate">
                {currentTrack?.title}
              </span>
              <span className="text-white/40 text-[10px] truncate">
                by {currentTrack?.artist}
              </span>

              {/* Progress Slider (simulated) */}
              <div className="w-full bg-neutral-800 h-1 rounded-full mt-2 overflow-hidden relative">
                <div
                  className="bg-[#00F0FF] h-full rounded-full shadow-[0_0_8px_#00F0FF]"
                  style={{ width: `${trackProgress}%` }}
                />
              </div>
            </div>

            {/* Play Button Action */}
            <button
              onClick={() => setIsPlayingTrack(!isPlayingTrack)}
              className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shrink-0"
            >
              {isPlayingTrack ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
            </button>
          </div>

          {/* Tracks Selection List */}
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            {tracks.map((track, idx) => {
              const isActive = idx === activeTrackIndex;
              return (
                <div
                  key={track.id}
                  onClick={() => {
                    setActiveTrackIndex(idx);
                    setIsPlayingTrack(true);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? "bg-[#B026FF]/10 border-[#B026FF]/40 shadow-[0_0_10px_rgba(176,38,255,0.1)]"
                      : "bg-white/5 border-transparent hover:bg-white/10"
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold text-white/30">
                    0{idx + 1}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-white text-[10px] font-bold truncate leading-tight">
                      {track.title}
                    </span>
                    <span className="text-white/40 text-[8px] truncate leading-none mt-0.5">
                      {track.artist}
                    </span>
                  </div>
                  {isActive && isPlayingTrack && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-ping shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 3: POPULAR WORLDS LIST (1x2) - ASYMMETRICAL COLUMN */}
        <div
          className="col-span-1 row-span-2 rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-[#B026FF]/30 p-3.5 flex flex-col gap-3 shadow-[0_0_20px_rgba(0,0,0,0.4)] relative overflow-hidden min-h-[250px]"
          id="popular-worlds-card"
        >
          <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-[#00F0FF]/5 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#00F0FF]" />
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                Hot Worlds
              </h3>
            </div>
            <span className="text-white/40 text-[9px]">Top community hubs</span>
          </div>

          {/* Worlds list */}
          <div className="flex flex-col gap-2.5 flex-1 justify-center">
            {popularWorlds.map((world, idx) => (
              <div
                key={world.id}
                onClick={() => navigate(`/world/${world.id}`)}
                className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-[#00F0FF]/20 hover:bg-white/10 cursor-pointer transition-all group/worldItem"
              >
                {/* World Initials Sphere */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[10px] border border-white/10 bg-gradient-to-br from-[#B026FF]/30 to-transparent shrink-0">
                  {world.initials || world.name?.slice(0, 2)}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-white font-bold text-[10px] truncate leading-tight group-hover/worldItem:text-[#00F0FF] transition-colors">
                    {world.name}
                  </span>
                  <span className="text-white/40 text-[8px] truncate mt-0.5">
                    {formatCount(world.members || 0)} members
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Call to action */}
          <button
            onClick={() => navigate("/worlds")}
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-all mt-auto flex items-center justify-center gap-1"
          >
            Explore All <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* CARD 4: TOP CREATOR SPOTLIGHT (1x1) */}
        {loadingCreators ? (
          <div className="col-span-1 aspect-square rounded-3xl bg-neutral-900/60 border border-white/5 p-3.5 flex flex-col justify-between overflow-hidden relative">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="w-12 h-3 bg-white/10 rounded" />
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="w-16 h-2.5 bg-white/10 rounded" />
              <div className="w-10 h-2 bg-white/10 rounded" />
            </div>
            <div className="w-12 h-2 mx-auto bg-white/10 rounded" />
          </div>
        ) : (
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate(`/profile/${asyncCreators[0].username}`)}
            className="col-span-1 aspect-square rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-[#00F0FF]/30 p-3.5 flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.4)] cursor-pointer relative overflow-hidden"
            id="creator-spotlight-card"
          >
            {/* Neon Ring Background Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(176,38,255,0.08)_0%,_transparent_70%)]" />

            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black tracking-wider text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded-full uppercase">
                Spotlight
              </span>
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
            </div>

            <div className="flex flex-col items-center text-center py-1">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#B026FF] to-[#00F0FF] animate-spin blur-[2px] opacity-70" />
                <img
                  src={asyncCreators[0].avatar}
                  alt="Top Creator"
                  className="w-10 h-10 rounded-full border-2 border-[#0A0A0A] relative z-10 object-cover"
                />
              </div>
              <span className="text-white font-bold text-[11px] mt-1.5 truncate max-w-full">
                {asyncCreators[0].displayName}
              </span>
              <span className="text-white/40 text-[9px]">@{asyncCreators[0].username}</span>
            </div>

            <div className="text-center text-[8px] font-bold text-[#00F0FF] tracking-wider uppercase">
              {(asyncCreators[0].followers / 1000).toFixed(1)}K Fans
            </div>
          </motion.div>
        )}

        {/* CARD 5: SECONDARY HOT VIBE (1x1) */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => navigate(`/vibes?id=${secondaryVibe?.id}`)}
          className="col-span-1 aspect-square rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-[#00F0FF]/30 overflow-hidden relative shadow-[0_0_20px_rgba(0,0,0,0.4)] cursor-pointer"
          id="secondary-vibe-card"
        >
          {secondaryVibe ? (
            <>
              <img
                src={secondaryVibe.avatar}
                alt="Vibe Thumbnail"
                className="w-full h-full object-cover opacity-40 hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              {/* Badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className="text-[7px] font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  🔥 Trending
                </span>
              </div>
              {/* Stats & User bottom overlay */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-col">
                <span className="text-white font-black text-[9px] truncate">
                  @{secondaryVibe.user}
                </span>
                <span className="text-white/60 text-[8px] truncate leading-tight">
                  ⚡ {formatCount(secondaryVibe.pulseCount || 0)} views
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
          )}
        </motion.div>

        {/* CARD 6: RISING CREATORS ROW (2x1) */}
        <div
          className="col-span-2 rounded-3xl bg-neutral-900/60 border border-white/5 p-4 flex flex-col gap-3 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
          id="rising-creators-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-[#00F0FF]" />
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                Rising Creators
              </h3>
            </div>
            <button
              onClick={() => navigate("/connect")}
              className="text-[#00F0FF] text-[9px] font-bold flex items-center gap-0.5 hover:underline"
            >
              Connect <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Horizontal scroll of users */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {loadingCreators ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center text-center bg-white/5 border border-white/5 rounded-2xl p-2.5 shrink-0 w-24 relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="w-12 h-2 bg-white/10 rounded mt-2" />
                  <div className="w-8 h-1.5 bg-white/10 rounded mt-1" />
                  <div className="w-16 h-4 bg-white/10 rounded mt-2" />
                </div>
              ))
            ) : (
              asyncCreators.slice(1).map((creator) => {
                const username = getCleanUsername(creator.handle);
                const isUserFollowing =
                  followToggleState[username] !== undefined
                    ? followToggleState[username]
                    : isFollowing(username);

                return (
                  <div
                    key={creator.id}
                    onClick={() => navigate(`/profile/${username}`)}
                    className="flex flex-col items-center text-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-2.5 shrink-0 w-24 cursor-pointer transition-all relative group"
                  >
                    <div className="relative">
                      {/* Glowing ring */}
                      <div
                        className={`absolute -inset-1 rounded-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF] opacity-0 group-hover:opacity-60 blur-[1px] transition-opacity`}
                      />
                      <img
                        src={creator.avatar}
                        alt={creator.name}
                        className="w-10 h-10 rounded-full border border-neutral-800 object-cover bg-neutral-900 relative z-10"
                      />
                    </div>

                    <span className="text-white text-[9px] font-bold mt-2 truncate w-full">
                      {creator.displayName}
                    </span>
                    <span className="text-white/40 text-[7px] truncate w-full">
                      {creator.handle}
                    </span>

                    {/* Follow button */}
                    <button
                      onClick={(e) => handleFollowClick(e, username)}
                      className={`mt-2 w-full py-1 rounded-full text-[8px] font-black transition-all flex items-center justify-center gap-0.5 ${
                        isUserFollowing
                          ? "bg-white/10 text-white/50 border border-white/10"
                          : "bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black shadow-[0_0_8px_rgba(0,240,255,0.3)]"
                      }`}
                    >
                      {isUserFollowing ? (
                        <>
                          <UserCheck className="w-2 h-2" />
                          <span>Joined</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-2.5 h-2.5" />
                          <span>Hype</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CARD 7: SURPRISE ME DICE ACTION (1x1) */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={handleRollDice}
          className="col-span-1 aspect-square rounded-3xl bg-gradient-to-br from-[#B026FF]/20 to-neutral-900/60 border border-[#B026FF]/30 p-4 flex flex-col justify-between shadow-[0_0_20px_rgba(176,38,255,0.15)] cursor-pointer relative overflow-hidden group"
          id="surprise-dice-card"
        >
          {/* Animated colorful backing */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#B026FF]/20 via-transparent to-pink-500/10 opacity-60 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-[8px] font-black text-[#B026FF] tracking-wider uppercase bg-[#B026FF]/10 px-2 py-0.5 rounded-full">
              Surprise
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#B026FF] animate-pulse" />
          </div>

          <div className="flex flex-col items-center justify-center py-2 relative z-10">
            <motion.div
              animate={isRolling ? { rotate: [0, 180, 360], scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="text-4xl filter drop-shadow-[0_0_12px_rgba(176,38,255,0.5)]"
            >
              🎲
            </motion.div>
          </div>

          <div className="text-center relative z-10 flex flex-col">
            <span className="text-white font-black text-[10px] tracking-wide uppercase">
              ROLL DICE
            </span>
            <span className="text-white/40 text-[7px] leading-none mt-0.5">
              Random Vibe Roll
            </span>
          </div>
        </motion.div>

        {/* CARD 8: QUICK LANGUAGE ROOM ENTER (1x1) */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => onOpenRoom({ id: "te", name: "Telugu", flag: "🇮🇳", langCode: "te", vibeCount: 1240 })}
          className="col-span-1 aspect-square rounded-3xl bg-neutral-900/60 border border-white/5 hover:border-[#00F0FF]/30 p-4 flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.4)] cursor-pointer relative overflow-hidden"
          id="quick-language-card"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -bottom-10 -right-10 w-20 h-20 bg-[#00F0FF]/5 rounded-full blur-xl" />

          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-[#00F0FF] tracking-wider uppercase bg-[#00F0FF]/10 px-2 py-0.5 rounded-full">
              Live Room
            </span>
            <Globe className="w-3.5 h-3.5 text-[#00F0FF] animate-spin-slow" />
          </div>

          <div className="flex flex-col items-center py-1">
            <span className="text-2xl">🇮🇳</span>
            <span className="text-white font-black text-[11px] mt-1.5">Telugu Room</span>
            <span className="text-white/40 text-[8px] mt-0.5">1.2K Online</span>
          </div>

          <div className="text-center text-[8px] text-[#00F0FF] font-black uppercase tracking-wider flex items-center justify-center gap-0.5 group">
            <span>Enter Now</span>
            <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </motion.div>

      </div>
    </div>
  );
}
