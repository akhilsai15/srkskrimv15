# Real Calling Merge (skrimcall → srskrimv99) — v7

This adds real, working audio/video calling to SkrimChat by merging in the
`skrim-calling` (skrimcall) WebRTC engine. Previously, `AudioCallScreen` /
`VideoCallScreen` were pure UI mockups driven by fake timers (see the old
`src/lib/mock/mockCalls.ts` and `src/lib/livekit/config.ts` stubs) — no audio,
no video, no network calls. That's now replaced with real
`getUserMedia` + `RTCPeerConnection` + WebSocket signaling.

## What changed

- **`server.ts`** (new, project root): the app no longer runs via
  `vite --port=3000` directly. It now runs through a small Express server
  (ported from skrimcall) that hosts the Vite dev middleware **and** a
  WebSocket signaling endpoint at `/ws`, plus a small in-memory public-key /
  prekey-bundle registry (`/register-key`, `/keys/bundle`, `/key/:userId`)
  for the E2E crypto layer.
- **`src/lib/e2e/calling/webrtc.ts`, `groupCall.ts`** — ported as-is from
  skrimcall. `CallManager` does the actual `getUserMedia` capture, SDP
  offer/answer, ICE candidate exchange, mute/camera toggling, and connection
  stats monitoring (auto audio-only fallback on bad network).
- **`src/lib/e2e/crypto/*`** — the Signal-protocol-style E2E crypto library
  (double ratchet, X3DH-style key exchange, sender keys, key storage) from
  skrimcall, ported for future use. **Not yet wired into 1:1 chat message
  encryption** — this merge focuses on calls only, per your last answer.
  `src/lib/encryption.ts` (chat message AES-GCM) is untouched.
- **`src/lib/e2e/calling/callEngine.ts`** (new) — a small singleton that:
  - opens/maintains the WebSocket connection to `/ws`
  - wraps `CallManager` and relays its signaling messages over the socket
  - emits events (`localStream`, `remoteStream`, `incomingCall`,
    `callStateChange`, `connectionStateChange`, `callEnded`)
- **`src/store/callStore.ts`** — same public shape as before (so no other
  screen needed to change), but `startCall` / `acceptCall` / `declineCall` /
  `endCall` / `toggleMute` / `toggleCamera` now actually drive `callEngine`,
  and `localStream` / `remoteStream` were added to state. Exports a new
  `initCallEngine(userId)`.
- **`src/App.tsx`** — calls `initCallEngine(currentUser.id)` once a user is
  logged in, so the device can receive incoming calls at any time.
- **`AudioCallScreen.tsx` / `VideoCallScreen.tsx`** — added real `<video>` /
  `<audio>` elements bound to `localStream`/`remoteStream` (layered over the
  existing decorative gradients/avatars, which still show as a fallback
  before media loads). Removed the old **fake auto-progression timers**
  (`outgoing → connecting → incoming` after a few seconds, and the random
  "network drop simulation") since real signaling now drives call state and
  real `RTCPeerConnection` stats now drive `networkQuality`.
- **`package.json`** — `dev` now runs `tsx server.ts` (was `vite --port=3000`);
  added `build`/`start` scripts to bundle+run the server for production;
  added `ws`, `libsodium-wrappers` (+ `@types/ws`, `vitest`,
  `fake-indexeddb` for the crypto unit tests carried over from skrimcall).
- **`docker-compose.yml`** (new) — optional local coturn STUN/TURN server,
  useful for testing calls across strict NATs/firewalls.

## How calling works now

1. On login, each client connects to `/ws` and joins one shared signaling
   room (`skrimchat-app`). Every signaling message (`offer`/`answer`/
   `ice-candidate`/`hangup`/`call-decline`) is still addressed directly via
   `targetId`, so this is safe at the scale of a single deployed instance —
   it mirrors how the original skrimcall test page worked with a single
   room, just always-on instead of manually joined per test.
2. Tapping call in `ChatThreadScreen` calls `startCall(type, { id: chatId, ... })`,
   which calls `callEngine.call(chatId, type)` → real `getUserMedia` + SDP
   offer sent to that `chatId` over the socket.
3. The recipient's `callEngine` receives the `offer`, emits `incomingCall`,
   and the store shows the existing incoming-call UI. Accepting calls
   `callEngine.accept()`, which answers with a real SDP answer.
4. ICE candidates flow both ways until `RTCPeerConnection` reports
   `connected`; `onRemoteStream`/`onLocalStream` populate the `<video>`/
   `<audio>` elements.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000 — app + signaling server together
```

For production:

```bash
npm run build
npm start
```

## Known limitations / next steps

- Calling addressing uses the same `chatId` values the rest of the app
  already uses for chat threads (mostly mock/local data in this prototype),
  so two real separate logged-in sessions calling each other requires those
  ids to actually correspond to each other, same as messaging does today.
- Group calling (`groupCall.ts`) was carried over but not wired into any
  screen — 1:1 calling was the scope of this merge.
- The E2E crypto library (`src/lib/e2e/crypto`) is included but not yet used
  to encrypt chat messages or call media metadata — only WebRTC's own
  built-in DTLS-SRTP secures the call media today. Say the word if you'd
  like the next pass to wire it into 1:1 chat messages too.
- `firestore.rules` / the key-bundle registry are in-memory only (reset on
  server restart) — fine for local/dev, would need persistence for prod.
