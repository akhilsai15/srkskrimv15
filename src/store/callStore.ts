import { create } from "zustand";
import { callEngine } from "../lib/e2e/calling/callEngine";
import { getChatByIdAsync } from "../lib/mock/mockChatDirectory";

export interface CallContact {
  id: string;
  name: string;
  avatar?: string | null;
  online?: boolean;
}

export interface CallState {
  isActive: boolean;
  type: "audio" | "video";
  state: "idle" | "outgoing" | "connecting" | "incoming" | "active";
  contact: CallContact | null;
  startTime: number | null;
  duration: number;
  isMuted: boolean;
  isSpeaker: boolean;
  showKeypad: boolean;
  addedContacts: CallContact[];
  isMinimized: boolean;

  // Real media, populated by the WebRTC call engine.
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  // Video specific state
  isCameraOff: boolean;
  isBlurEnabled: boolean;
  activeFilter: "normal" | "cool" | "neon" | "soft" | "gold" | "ocean";
  pinnedMessage: string | null;
  cameraFacing: "front" | "back";
  networkQuality: "good" | "ok" | "poor";

  // Surfaced when starting/accepting a call fails (e.g. camera/mic
  // permission denied or no device found) so the UI can tell the user why
  // the call screen closed instead of silently doing nothing.
  callError: string | null;

  onCallEnded?: (
    duration: number,
    reason: "completed" | "missed",
    type: "audio" | "video",
  ) => void;

  startCall: (
    type: "audio" | "video",
    contact: CallContact,
    isIncoming?: boolean,
    onCallEnded?: (
      duration: number,
      reason: "completed" | "missed",
      type: "audio" | "video",
    ) => void,
  ) => void;
  acceptCall: (type?: "audio" | "video") => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleKeypad: () => void;
  addContact: (contact: CallContact) => void;
  setMinimized: (min: boolean) => void;
  setDuration: (dur: number) => void;
  setState: (state: CallState["state"]) => void;

  // Video actions
  toggleCamera: () => void;
  toggleBlur: () => void;
  setFilter: (filter: CallState["activeFilter"]) => void;
  setPinnedMessage: (msg: string | null) => void;
  toggleCameraFacing: () => void;
  setNetworkQuality: (quality: CallState["networkQuality"]) => void;
  clearCallError: () => void;
}

/**
 * Starting/accepting a call almost always fails for one of a handful of
 * predictable reasons (permission denied, no camera/mic, device already in
 * use, or the browser blocking media access on an insecure origin). Turn
 * those into a message the person can actually act on instead of the call
 * screen just silently closing.
 */
function describeCallError(err: any): string {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera/microphone access was blocked. Please allow access in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera or microphone was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your camera or microphone is already in use by another app.";
  }
  if (name === "SecurityError") {
    return "Camera/microphone access isn't allowed on this connection.";
  }
  if (
    typeof navigator !== "undefined" &&
    (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
  ) {
    return "This browser doesn't support video/voice calling.";
  }
  return "Couldn't connect the call. Please check your connection and try again.";
}

export const useCallStore = create<CallState>((set, get) => ({
  isActive: false,
  type: "audio",
  state: "idle",
  contact: null,
  startTime: null,
  duration: 0,
  isMuted: false,
  isSpeaker: false,
  showKeypad: false,
  addedContacts: [],
  isMinimized: false,

  localStream: null,
  remoteStream: null,

  isCameraOff: false,
  isBlurEnabled: false,
  activeFilter: "normal",
  pinnedMessage: null,
  cameraFacing: "front",
  networkQuality: "good",
  callError: null,

  onCallEnded: undefined,

  startCall: (type, contact, isIncoming = false, onCallEnded) => {
    set({
      isActive: true,
      type,
      state: isIncoming ? "incoming" : "outgoing",
      contact,
      startTime: null,
      duration: 0,
      isMuted: false,
      isSpeaker: type === "video", // auto-speaker for video
      showKeypad: false,
      addedContacts: [],
      isMinimized: false,
      isCameraOff: false,
      isBlurEnabled: false,
      activeFilter: "normal",
      pinnedMessage: null,
      cameraFacing: "front",
      networkQuality: "good",
      onCallEnded,
    });

    if (!isIncoming) {
      // Kick off the real WebRTC offer in the background. If media
      // acquisition or signaling fails, fall back to ending the call so the
      // UI doesn't hang on a call that will never connect.
      callEngine.call(contact.id, type).catch((err) => {
        set({ callError: describeCallError(err) });
        get().endCall();
      });
    }
  },

  acceptCall: (typeOverride) => {
    const type = typeOverride || get().type;
    set((s) => ({
      state: "active",
      type,
      startTime: Date.now(),
      isSpeaker: type === "video" ? true : s.isSpeaker,
    }));
    callEngine.accept(type).catch((err) => {
      set({ callError: describeCallError(err) });
      get().endCall();
    });
  },

  declineCall: () => {
    const { onCallEnded, type } = get();
    callEngine.decline();
    if (onCallEnded) onCallEnded(0, "missed", type);
    set({ isActive: false, state: "idle", duration: 0, localStream: null, remoteStream: null });
  },

  endCall: () => {
    const { onCallEnded, duration, state, type } = get();
    callEngine.hangup();
    if (onCallEnded)
      onCallEnded(duration, state === "active" ? "completed" : "missed", type);
    set({ isActive: false, state: "idle", duration: 0, startTime: null, localStream: null, remoteStream: null });
  },

  toggleMute: () =>
    set((s) => {
      const next = !s.isMuted;
      callEngine.setMuted(next);
      return { isMuted: next };
    }),
  toggleSpeaker: () => set((s) => ({ isSpeaker: !s.isSpeaker })),
  toggleKeypad: () => set((s) => ({ showKeypad: !s.showKeypad })),
  addContact: (contact) =>
    set((s) => ({ addedContacts: [...s.addedContacts, contact] })),
  setMinimized: (min) => set({ isMinimized: min }),
  setDuration: (dur) => set({ duration: dur }),
  setState: (state) => set({ state }),

  toggleCamera: () =>
    set((s) => {
      const next = !s.isCameraOff;
      callEngine.setCameraOff(next);
      return { isCameraOff: next };
    }),
  toggleBlur: () => set((s) => ({ isBlurEnabled: !s.isBlurEnabled })),
  setFilter: (activeFilter) => set({ activeFilter }),
  setPinnedMessage: (pinnedMessage) => set({ pinnedMessage }),
  toggleCameraFacing: () =>
    set((s) => ({
      cameraFacing: s.cameraFacing === "front" ? "back" : "front",
    })),
  setNetworkQuality: (networkQuality) => set({ networkQuality }),
  clearCallError: () => set({ callError: null }),
}));

// ---------------------------------------------------------------------------
// Wire the call engine's events into the store. This subscription lives at
// module scope (not inside a component) so it stays active for the whole
// app session regardless of which screens are mounted.
// ---------------------------------------------------------------------------
let engineWired = false;
function wireCallEngineOnce() {
  if (engineWired) return;
  engineWired = true;

  callEngine.on("localStream", (stream: MediaStream) => {
    useCallStore.setState({ localStream: stream });
  });

  callEngine.on("remoteStream", (stream: MediaStream) => {
    useCallStore.setState({ remoteStream: stream });
  });

  callEngine.on("callStateChange", (rtcState: string) => {
    const s = useCallStore.getState();
    if (!s.isActive) return;
    if (rtcState === "acquiring") {
      useCallStore.setState({ state: s.state === "incoming" ? "incoming" : "connecting" });
    } else if (rtcState === "connected") {
      useCallStore.setState({ state: "active", startTime: s.startTime || Date.now() });
    }
  });

  callEngine.on("connectionStateChange", (pcState: RTCPeerConnectionState) => {
    if (pcState === "connected") useCallStore.setState({ networkQuality: "good" });
    else if (pcState === "disconnected") useCallStore.setState({ networkQuality: "poor" });
    else if (pcState === "failed") useCallStore.setState({ networkQuality: "poor" });
  });

  callEngine.on("callEnded", () => {
    // The remote side hung up or declined; mirror that locally without
    // re-sending a hangup signal (callEngine already tore down the peer
    // connection at this point).
    const s = useCallStore.getState();
    if (!s.isActive) return;
    if (s.onCallEnded) {
      s.onCallEnded(s.duration, s.state === "active" ? "completed" : "missed", s.type);
    }
    useCallStore.setState({
      isActive: false,
      state: "idle",
      duration: 0,
      startTime: null,
      localStream: null,
      remoteStream: null,
    });
  });

  callEngine.on("incomingCall", async ({ from, type }: { from: string; type: "audio" | "video" }) => {
    const s = useCallStore.getState();
    if (s.isActive) return; // already on a call — real app would send "busy"
    try {
      const chat = await getChatByIdAsync(from);
      s.startCall(
        type,
        { id: from, name: chat.displayName, avatar: chat.avatar, online: true },
        true,
      );
    } catch (err) {
      console.error("Failed to load chat lookup for incoming call:", err);
    }
  });
}

/**
 * Connects the signaling client for the given (logged-in) user id and wires
 * its events into this store. Safe to call multiple times; only the first
 * call sets up the event bridge, subsequent calls just (re)connect the
 * socket (e.g. after switching accounts).
 */
export function initCallEngine(userId: string) {
  wireCallEngineOnce();
  callEngine.connect(userId);
}
