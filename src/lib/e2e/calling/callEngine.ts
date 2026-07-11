// callEngine.ts
//
// Bridges the ported `skrim-calling` WebRTC engine (CallManager) and its
// WebSocket signaling protocol into SkrimChat. This is a plain singleton
// (not a React hook) so it can hold a persistent WebSocket connection for
// the lifetime of the app and be driven from Zustand (see store/callStore.ts).
//
// Usage:
//   callEngine.connect(myUserId)                 // once, e.g. on login
//   callEngine.on('incomingCall', ({ from, type }) => { ... })
//   callEngine.call(targetUserId, 'video')
//   callEngine.accept() / callEngine.decline() / callEngine.hangup()
//   callEngine.setMuted(true) / callEngine.setCameraOff(true)
import { CallManager } from "./webrtc";

export type CallEngineEvent =
  | "localStream"
  | "remoteStream"
  | "callStateChange"
  | "incomingCall"
  | "connectionStateChange"
  | "connectedToSignaling"
  | "disconnectedFromSignaling"
  | "callEnded";

type Listener = (payload: any) => void;

// The signaling server relays targeted messages (offer/answer/ice/hangup) by
// looking up `targetId` inside the *sender's own room*. Since callers and
// callees don't negotiate a shared room ahead of time, every connected client
// joins one shared presence room for the whole app; targetId still ensures
// only the intended peer ever receives a given signal.
const GLOBAL_SIGNALING_ROOM = "skrimchat-app";

class CallEngine {
  private ws: WebSocket | null = null;
  private manager: CallManager | null = null;
  private myUserId: string = "";
  private currentRoomId: string = "";
  private nextSeq = 1;
  private listeners: Map<CallEngineEvent, Set<Listener>> = new Map();
  private reconnectTimer: any = null;

  public on(event: CallEngineEvent, cb: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private emit(event: CallEngineEvent, payload?: any) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  /** Opens (or re-opens) the persistent signaling connection for this user. */
  public connect(userId: string, authToken: string = "skrimchat-session-token") {
    if (this.ws && this.myUserId === userId && this.ws.readyState === WebSocket.OPEN) return;
    this.myUserId = userId;

    if (!this.manager) {
      this.manager = new CallManager(userId, "");
      this.manager.callbacks = {
        onLocalStream: (stream) => this.emit("localStream", stream),
        onRemoteStream: (stream) => this.emit("remoteStream", stream),
        onCallStateChange: (state) => this.emit("callStateChange", state),
        onConnStateChange: (state) => this.emit("connectionStateChange", state),
        onSignalingMessage: (msg) => this.sendSignal(msg),
        onLog: () => {},
      };
    }

    this.openSocket();
  }

  private openSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.emit("connectedToSignaling", undefined);
      this.joinRoom(GLOBAL_SIGNALING_ROOM);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSignal(data);
      } catch (e) {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      this.emit("disconnectedFromSignaling", undefined);
      // Best-effort auto-reconnect so incoming calls keep working.
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (this.myUserId) this.openSocket();
      }, 2000);
    };

    ws.onerror = () => {
      // onclose will fire right after; reconnect handled there.
    };
  }

  private joinRoom(roomId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.currentRoomId = roomId;
    this.nextSeq = 1;
    this.ws.send(
      JSON.stringify({ type: "join", roomId, userId: this.myUserId, token: "skrimchat-session-token" }),
    );
    this.manager?.setIdentity(this.myUserId, roomId);
  }

  private sendSignal(msg: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({ ...msg, seq: this.nextSeq++, timestamp: new Date().toISOString() }),
    );
  }

  private handleSignal(data: any) {
    switch (data.type) {
      case "offer": {
        // Someone is calling us. Figure out whether this looks like a video
        // call from the SDP (has an m=video section) so the UI can show the
        // right ringing screen.
        const isVideo = typeof data.sdp?.sdp === "string" && /m=video/.test(data.sdp.sdp);
        this.manager?.handleIncomingOffer(data.senderId, data.sdp);
        this.emit("incomingCall", { from: data.senderId, type: isVideo ? "video" : "audio" });
        break;
      }
      case "answer":
        this.manager?.handleIncomingAnswer(data.senderId, data.sdp);
        break;
      case "ice-candidate":
        this.manager?.handleIceCandidate(data.senderId, data.candidate);
        break;
      case "call-decline":
        if (this.manager?.getCurrentCallPeer() === data.senderId) {
          this.manager.resetCallState();
          this.emit("callEnded", { reason: "declined" });
        }
        break;
      case "hangup":
        if (this.manager?.getCurrentCallPeer() === data.senderId) {
          this.manager.resetCallState();
          this.emit("callEnded", { reason: "hangup" });
        }
        break;
      default:
        break;
    }
  }

  /** Starts an outgoing call to `targetUserId`. Both users must already be
   * connected (see `connect`), which joins the shared signaling room. */
  public async call(targetUserId: string, type: "audio" | "video") {
    if (this.currentRoomId !== GLOBAL_SIGNALING_ROOM || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.joinRoom(GLOBAL_SIGNALING_ROOM);
      await new Promise((r) => setTimeout(r, 150));
    }
    await this.manager?.createCall(targetUserId, { audio: true, video: type === "video" });
  }

  /** Accepts the currently ringing incoming call. */
  public async accept(type: "audio" | "video") {
    await this.manager?.acceptCall({ audio: true, video: type === "video" });
  }

  public decline() {
    this.manager?.declineCall();
  }

  public hangup() {
    this.manager?.endCall();
  }

  public setMuted(muted: boolean) {
    this.manager?.muteMic(muted);
  }

  public setCameraOff(off: boolean) {
    this.manager?.toggleCamera(!off);
  }

  public getLocalStream(): MediaStream | null {
    return this.manager?.getLocalStream() ?? null;
  }
}

export const callEngine = new CallEngine();
