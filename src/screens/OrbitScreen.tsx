import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, Users, Sparkles, ShieldAlert, Eye, X, Mic, MicOff, LogIn, MapPin, MapPinOff } from 'lucide-react';
import { useOrbit } from '../hooks/useOrbit';
import { OrbitUserCard } from '../components/orbit/OrbitUserCard';
import { IcebreakerSheet } from '../components/orbit/IcebreakerSheet';
import { OrbitSettingsSheet } from '../components/orbit/OrbitSettingsSheet';
import { OrbitUser, MOOD_META, mockActivityRooms, mockOrbitEvents, IcebreakerType, ActivityRoom } from '../lib/mock/mockOrbit';
import { useVoiceRoomStore, VoiceRoomData } from '../store/voiceRoomStore';

export default function OrbitScreen() {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    visibleUsers,
    requestStatusFor,
    sendRequest,
    canSendRequest,
    requestsRemaining,
    dailyLimit,
    locationStatus,
    requestLocation,
    isLoading,
    error,
  } = useOrbit();

  const [icebreakerUser, setIcebreakerUser] = useState<OrbitUser | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenshotNotice, setScreenshotNotice] = useState<string | null>(null);
  const [activeRoomModal, setActiveRoomModal] = useState<ActivityRoom | null>(null);
  const { setActiveRoom } = useVoiceRoomStore();

  const myMood = MOOD_META[settings.mood];
  const crossedPathsUsers = visibleUsers.filter((u) => u.crossedPathsToday);

  const handleOpenProfile = (user: OrbitUser) => {
    const status = requestStatusFor(user.id);
    if (status === 'accepted') {
      navigate(`/chat/${user.id}`);
    } else {
      // Identity stays partially hidden until accepted — show the icebreaker flow instead.
      setIcebreakerUser(user);
    }
  };

  const handleJoinRoom = (room: ActivityRoom) => {
    const roomData: VoiceRoomData = {
      id: `room_${room.id}`,
      title: room.name,
      community: 'Orbit',
      atmosphere: 'nebula',
      startedAt: Date.now() - 5 * 60 * 1000,
      isLive: true,
      isLocked: false,
      speakers: [
        { id: 's1', name: 'Host', initial: room.emoji, role: 'host', muted: false, speaking: false },
      ],
      listeners: Array.from({ length: Math.min(room.orbitCount - 1, 8) }, (_, i) => ({
        id: `l${i + 1}`,
        initial: String.fromCharCode(65 + i),
      })),
      totalListeners: room.orbitCount,
    };
    setActiveRoom(roomData, 'pre-entry');
    setActiveRoomModal(null);
  };

  const handleSend = (type: IcebreakerType) => {
    if (!icebreakerUser) return false;
    return sendRequest(icebreakerUser.id, type);
  };

  // Mock screenshot-detection notice — real screenshot detection isn't possible
  // in a web app; this simulates what the native-app behavior would notify.
  const simulateScreenshotNotice = (name: string) => {
    setScreenshotNotice(`${name} took a screenshot.`);
    setTimeout(() => setScreenshotNotice(null), 3000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-skrim-bg text-white overflow-hidden relative">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5 shrink-0">
        <div>
          <h1 className="text-xl font-black text-glow-purple">Orbit</h1>
          <p className="text-[11px] text-white/40">People orbit, by interest — not followers</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full glass-panel"
            style={{ color: myMood.color }}
          >
            {myMood.emoji} {myMood.label}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-full glass-panel"
            aria-label="Orbit settings"
          >
            <Settings2 className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Location permission banner */}
      {locationStatus === 'requesting' && (
        <div className="px-4 py-2 flex items-center gap-2 text-[11px] text-white/50 bg-white/5 border-b border-white/5 shrink-0">
          <MapPin className="w-3.5 h-3.5 animate-pulse text-neon-blue" />
          Finding people near your current location...
        </div>
      )}
      {(locationStatus === 'denied' || locationStatus === 'unsupported') && (
        <div className="px-4 py-2 flex items-center justify-between gap-2 text-[11px] bg-white/5 border-b border-white/5 shrink-0">
          <span className="flex items-center gap-2 text-white/50">
            <MapPinOff className="w-3.5 h-3.5" />
            {locationStatus === 'unsupported'
              ? "Location isn't available on this device — showing approximate results."
              : 'Location access is off — showing approximate results.'}
          </span>
          {locationStatus === 'denied' && (
            <button
              onClick={requestLocation}
              className="text-neon-blue font-bold shrink-0"
            >
              Enable
            </button>
          )}
        </div>
      )}

      {/* Screenshot notice toast (mock) */}
      {screenshotNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          {screenshotNotice}
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {locationStatus === 'idle' ? (
          <div className="p-6 flex flex-col items-center justify-center text-center max-w-sm mx-auto my-12 glass-panel rounded-3xl border border-white/10 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-[#00F0FF]/10 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-[#00F0FF] animate-pulse" />
            </div>
            <h3 className="text-lg font-black mb-2 text-white animate-fade-in">Privacy-First Orbit Discovery</h3>
            <p className="text-xs text-white/60 leading-relaxed mb-6">
              Orbit connects you with interesting people nearby. To protect your privacy, we only query your location just-in-time and never track you in the background.
            </p>
            <button
              onClick={requestLocation}
              className="w-full py-3 rounded-2xl font-bold text-sm text-black bg-gradient-to-r from-neon-purple to-neon-blue shadow-neon-purple transition active:scale-95"
            >
              Enable Nearby Discovery
            </button>
            <p className="text-[10px] text-white/30 mt-3">
              You can withdraw consent or turn location off at any time.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
            <div className="w-8 h-8 rounded-full border-4 border-t-transparent border-[#00F0FF] animate-spin mb-4" />
            <p className="text-white/60 text-sm">Synchronizing orbital coordinate grid...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <p className="text-red-400 font-medium mb-3">{error}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full text-xs">Try Again</button>
          </div>
        ) : (
          <>
            {/* Radius / count bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-white/50">
            <span className="text-white font-bold">{visibleUsers.length}</span> people within{' '}
            <span className="text-neon-blue font-bold">{settings.radiusKm} km</span>
          </p>
          <p className="text-[11px] text-white/30">
            {requestsRemaining}/{dailyLimit} requests left today
          </p>
        </div>

        {/* Orbit events */}
        {mockOrbitEvents.length > 0 && (
          <div className="px-4 mb-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {mockOrbitEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="glass-panel rounded-2xl p-3 min-w-[200px] shrink-0 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Sparkles className="w-3.5 h-3.5 text-neon-purple" />
                    {evt.text}
                  </div>
                  <p className="text-sm font-bold">{evt.cta}</p>
                  <button
                    onClick={() => {
                      const matchedRoom = mockActivityRooms.find((r) =>
                        evt.text.toLowerCase().includes(r.name.split(' ')[0].toLowerCase())
                      ) || mockActivityRooms[0];
                      setActiveRoomModal(matchedRoom);
                    }}
                    className="self-start text-[11px] font-bold text-neon-blue mt-1"
                  >
                    Join →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity rooms */}
        <div className="px-4 mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Activity Rooms
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {mockActivityRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoomModal(room)}
                className="glass-panel rounded-xl px-3 py-2 min-w-[110px] shrink-0 text-left active:scale-95 transition"
              >
                <p className="text-lg">{room.emoji}</p>
                <p className="text-xs font-bold truncate">{room.name}</p>
                <p className="text-[10px] text-white/40">{room.orbitCount} orbit</p>
              </button>
            ))}
          </div>
        </div>

        {/* Crossed paths */}
        {crossedPathsUsers.length > 0 && (
          <div className="px-4 mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2 flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Crossed Paths Today
            </p>
            <div className="glass-panel rounded-2xl p-3 flex flex-col gap-2">
              {crossedPathsUsers.map((u) => (
                <p key={u.id} className="text-xs text-white/60">
                  You and <span className="text-white font-bold">{u.nickname}</span> were within 500
                  meters of each other today.
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Orbit people list */}
        <div className="px-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">
            Orbit People
          </p>
          <div className="flex flex-col gap-2">
            {visibleUsers.length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-center text-white/40 text-sm">
                No one matches your filters right now. Try widening your radius.
              </div>
            ) : (
              visibleUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    // Mock: randomly demonstrate the screenshot-detection notice when viewing a profile.
                    if (Math.random() < 0.08) simulateScreenshotNotice(user.nickname);
                  }}
                >
                  <OrbitUserCard
                    user={user}
                    status={requestStatusFor(user.id)}
                    onOpenIcebreaker={setIcebreakerUser}
                    onOpenProfile={handleOpenProfile}
                  />
                </div>
              ))
            )}
          </div>
        </div>
          </>
        )}
      </div>

      <IcebreakerSheet
        user={icebreakerUser}
        onClose={() => setIcebreakerUser(null)}
        onSend={handleSend}
        requestsRemaining={requestsRemaining}
      />

      <OrbitSettingsSheet
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onUpdate={updateSettings}
      />

      {/* Activity Room Modal */}
      {activeRoomModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setActiveRoomModal(null)}>
          <div
            className="w-full max-w-lg glass-panel rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeRoomModal.emoji}</span>
                <div>
                  <p className="font-black text-lg text-white">{activeRoomModal.name}</p>
                  <p className="text-[11px] text-white/40">{activeRoomModal.orbitCount} people orbit in this room</p>
                </div>
              </div>
              <button onClick={() => setActiveRoomModal(null)} className="p-2 rounded-full glass-panel">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50 glass-panel rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              Live voice room · Anyone orbit can join
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleJoinRoom(activeRoomModal)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-black bg-gradient-to-r from-neon-purple to-neon-blue shadow-neon-purple active:scale-95 transition"
              >
                <Mic className="w-4 h-4" /> Join as Speaker
              </button>
              <button
                onClick={() => handleJoinRoom(activeRoomModal)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white glass-panel active:scale-95 transition"
              >
                <LogIn className="w-4 h-4" /> Join as Listener
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
