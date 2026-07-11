/**
 * ============================================================================
 *          MANUAL TEST CHECKLIST: GROUP (MULTI-PARTY) WEBRTC CALLING
 * ============================================================================
 *
 * This uses a FULL-MESH topology: every participant opens a direct
 * RTCPeerConnection to every other participant. No media server is required,
 * but bandwidth/CPU cost grows roughly with N^2 connections - see the note
 * at the bottom of this file about when to move to a real SFU instead.
 *
 * 1. PREREQUISITES:
 *    - Start the signaling server locally: `npm run dev`
 *    - Open THREE browser tabs (or two tabs + test.html) all pointed at the
 *      same app, e.g. `http://localhost:3000/`.
 *
 * 2. ROOM ENTRY:
 *    - In Tab A, join Room ID "group-test". Note peer ID (e.g. "react-peer-1111").
 *    - In Tab B, join the SAME Room ID "group-test".
 *    - In Tab C, join the SAME Room ID "group-test".
 *    - Confirm all three tabs' "Active Room Members" list shows the other two.
 *
 * 3. STARTING THE GROUP CALL:
 *    - In Tab A, start a group call for the room (passing the other two peer IDs
 *      already in the room as `existingParticipantIds`).
 *    - Verify Tab A's logs show TWO separate RTCPeerConnections being created
 *      (one to Tab B's peer ID, one to Tab C's peer ID), and TWO real SDP offers
 *      sent out with matching targetId fields.
 *
 * 4. JOINING FROM THE OTHER TABS:
 *    - In Tab B and Tab C, call handleIncomingOffer() when the "offer" message
 *      arrives (same signaling message type used for 1:1 calls, just routed by
 *      targetId as it already is on the server).
 *    - Verify each tab answers, and that Tab A ends up with TWO connected
 *      RTCPeerConnections, while Tab B and Tab C each end up with ONE connection
 *      to Tab A (Tab B and Tab C do not automatically connect directly to each
 *      other in this simple flow - only the caller mesh-connects to everyone
 *      already in the room at call-start time).
 *
 * 5. STREAMS:
 *    - Verify onRemoteStreamsChange fires with a Map containing entries for
 *      every connected peer, and that each tab can render every other
 *      participant's video/audio tile.
 *
 * 6. PARTICIPANT LEAVING:
 *    - In Tab C, end the call / close the tab.
 *    - Verify Tab A and Tab B's remote stream maps drop Tab C's entry, and
 *      their UI can remove just that one tile while staying connected to
 *      each other.
 *
 * 7. MUTE / CAMERA:
 *    - Toggle mute/camera in Tab A. Verify the same shared local MediaStreamTrack
 *      is muted/unmuted across BOTH of Tab A's peer connections simultaneously
 *      (since one track is added to multiple RTCPeerConnections, disabling it
 *      once affects every connection using it).
 * ============================================================================
 */

import { CallManager, CallConfig, getIceServers } from './webrtc';

export interface GroupCallCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStreamsChange?: (streams: Map<string, MediaStream>) => void;
  onParticipantLeft?: (userId: string) => void;
  onSignalingMessage?: (msg: any) => void;
  onLog?: (direction: 'in' | 'out' | 'sys', type: string, payload: any) => void;
  onCallStateChange?: (state: 'idle' | 'acquiring' | 'connected' | 'ended') => void;
}

/**
 * Manages a multi-party (3+) audio/video call using a full-mesh of individual
 * CallManager instances - one real RTCPeerConnection per remote participant.
 *
 * Good for small groups (roughly up to 6-8 participants). Bandwidth and CPU
 * cost grow with N^2 connections in a full mesh, so if group calls need to
 * scale past that, replace this with a real SFU (e.g. mediasoup or LiveKit) -
 * that is intentionally NOT built here; this class is the mesh-based starting
 * point only.
 */
export class GroupCallManager {
  private peers: Map<string, CallManager> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private userId: string;
  private roomId: string;
  private config: CallConfig = { audio: true, video: true };

  public callbacks: GroupCallCallbacks = {};

  constructor(userId: string, roomId: string) {
    this.userId = userId;
    this.roomId = roomId;
  }

  public getParticipantIds(): string[] {
    return Array.from(this.peers.keys());
  }

  public getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Creates a fresh CallManager dedicated to one remote participant, wiring its
   * callbacks up to this group manager's aggregate callbacks.
   */
  private createManagerFor(peerId: string): CallManager {
    const mgr = new CallManager(this.userId, this.roomId);
    mgr.callbacks = {
      onSignalingMessage: (msg) => {
        this.callbacks.onSignalingMessage?.(msg);
      },
      onLog: (direction, type, payload) => {
        this.callbacks.onLog?.(direction, type, { peerId, ...payload });
      },
      onRemoteStream: (stream) => {
        if (stream && stream.getTracks().length > 0) {
          this.remoteStreams.set(peerId, stream);
        } else {
          this.remoteStreams.delete(peerId);
        }
        this.callbacks.onRemoteStreamsChange?.(new Map(this.remoteStreams));
      },
      onConnStateChange: (state) => {
        this.callbacks.onLog?.('sys', 'webrtc', `[group] connectionState for "${peerId}" -> "${state}"`);
        if (state === 'failed' || state === 'closed') {
          this.removeParticipant(peerId);
        }
      },
    };
    this.peers.set(peerId, mgr);
    return mgr;
  }

  /**
   * Acquires local media once (shared across every peer connection) and opens
   * an RTCPeerConnection + sends a real SDP offer to each already-present
   * participant in the room.
   */
  public async joinRoom(existingParticipantIds: string[], config?: CallConfig): Promise<void> {
    this.config = config || { audio: true, video: true };
    this.callbacks.onCallStateChange?.('acquiring');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: this.config.audio,
      video: this.config.video ? { facingMode: 'user' } : false,
    });
    this.localStream = stream;
    this.callbacks.onLocalStream?.(stream);

    for (const peerId of existingParticipantIds) {
      await this.callPeer(peerId);
    }

    this.callbacks.onCallStateChange?.('connected');
  }

  /**
   * Opens a new RTCPeerConnection to one peer and sends a real SDP offer.
   */
  private async callPeer(peerId: string): Promise<void> {
    if (this.peers.has(peerId) || !this.localStream) return;

    const mgr = this.createManagerFor(peerId);
    const pc = mgr.createPeerConnection(peerId);

    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.callbacks.onSignalingMessage?.({
      type: 'offer',
      roomId: this.roomId,
      targetId: peerId,
      sdp: pc.localDescription,
    });
    this.callbacks.onLog?.('out', 'offer', { targetId: peerId });
  }

  /**
   * Called when the signaling server tells us a new participant joined the room
   * after we're already in the call - meshes out to them too.
   */
  public async onParticipantJoined(peerId: string): Promise<void> {
    if (peerId === this.userId) return;
    await this.callPeer(peerId);
  }

  /**
   * Handles an incoming SDP offer from a peer we don't yet have a connection to
   * (or are being re-offered by).
   */
  public async handleIncomingOffer(senderId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.localStream) {
      this.callbacks.onCallStateChange?.('acquiring');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audio,
        video: this.config.video ? { facingMode: 'user' } : false,
      });
      this.callbacks.onLocalStream?.(this.localStream);
    }

    const mgr = this.peers.get(senderId) || this.createManagerFor(senderId);
    const pc = mgr.createPeerConnection(senderId);

    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.callbacks.onSignalingMessage?.({
      type: 'answer',
      roomId: this.roomId,
      targetId: senderId,
      sdp: pc.localDescription,
    });
    this.callbacks.onLog?.('out', 'answer', { targetId: senderId });
    this.callbacks.onCallStateChange?.('connected');
  }

  public async handleIncomingAnswer(senderId: string, answerSdp: RTCSessionDescriptionInit): Promise<void> {
    const mgr = this.peers.get(senderId);
    if (!mgr) return;
    await mgr.handleIncomingAnswer(senderId, answerSdp);
  }

  public async handleIceCandidate(senderId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const mgr = this.peers.get(senderId);
    if (!mgr) return;
    await mgr.handleIceCandidate(senderId, candidate);
  }

  /**
   * Closes and cleans up just one participant's connection - the rest of the
   * group call is unaffected.
   */
  public removeParticipant(peerId: string): void {
    const mgr = this.peers.get(peerId);
    if (mgr) {
      mgr.resetCallState();
    }
    this.peers.delete(peerId);
    this.remoteStreams.delete(peerId);
    this.callbacks.onRemoteStreamsChange?.(new Map(this.remoteStreams));
    this.callbacks.onParticipantLeft?.(peerId);
  }

  /**
   * Mutes/unmutes the shared local audio track. Since the same MediaStreamTrack
   * object is added to every peer connection, disabling it once affects all of
   * them simultaneously - no need to loop over each CallManager.
   */
  public muteMic(muted?: boolean): void {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = muted !== undefined ? !muted : !audioTrack.enabled;
  }

  /**
   * Enables/disables the shared local video track across all peer connections.
   */
  public toggleCamera(enabled?: boolean): void {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled;
  }

  /**
   * Ends the entire group call: sends hangup to every peer, tears down every
   * RTCPeerConnection, and stops all local media tracks.
   */
  public endCall(): void {
    this.peers.forEach((mgr) => {
      mgr.endCall();
    });
    this.peers.clear();
    this.remoteStreams.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.callbacks.onCallStateChange?.('ended');
  }
}

// Re-export so consumers of groupCall.ts don't also need to import from webrtc.ts
// for basic ICE server configuration if they want to inspect it directly.
export { getIceServers };
