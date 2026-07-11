// server.ts
// Unified dev/production server for SkrimChat.
//
// This merges in the `skrim-calling` WebRTC signaling server (originally a
// standalone project, "skrimcall") so that real, E2E-oriented voice/video
// calling can run alongside the main Vite + React app on a single Node
// process. It exposes:
//   - The Vite dev server / built SPA (same behavior as before)
//   - A WebSocket signaling endpoint at /ws for WebRTC offer/answer/ICE relay
//   - A small in-memory public-key / prekey-bundle registry used by the
//     Signal-protocol-style E2E crypto layer in src/lib/e2e/crypto
import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Enable JSON body parsing for API requests
  app.use(express.json());

  // ---------------------------------------------------------------------
  // In-memory key / prekey-bundle registry (used by src/lib/e2e/crypto)
  // ---------------------------------------------------------------------
  const publicKeyRegistry = new Map<string, string>();

  interface StoredBundle {
    identityPublicKey: string;
    signingIdentityPublicKey: string;
    signedPrekey: string;
    signedPreKeySignature: string;
    oneTimePrekeys: string[];
  }
  const keyBundleRegistry = new Map<string, StoredBundle>();

  const requireSessionToken = (req: any, res: any, next: any) => {
    const token = req.headers["x-session-token"];
    if (!token || typeof token !== "string" || !token.trim()) {
      res.status(401).json({ success: false, error: "Missing or invalid X-Session-Token header" });
      return;
    }
    next();
  };

  interface TokenBucket {
    tokens: number;
    lastRefill: number;
  }
  const rateLimitMap = new Map<string, TokenBucket>();

  const isRateLimited = (ip: string): boolean => {
    const now = Date.now();
    const limit = 10; // max requests
    const windowMs = 60000; // 1 minute
    const refillRate = limit / windowMs;

    let bucket = rateLimitMap.get(ip);
    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now };
    } else {
      const elapsed = now - bucket.lastRefill;
      bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      rateLimitMap.set(ip, bucket);
      return false;
    }
    rateLimitMap.set(ip, bucket);
    return true;
  };

  const rateLimiterMiddleware = (req: any, res: any, next: any) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
    const clientIp = typeof ip === "string" ? ip.split(",")[0].trim() : "anonymous";
    if (isRateLimited(clientIp)) {
      res.status(429).json({ success: false, error: "Too many requests. Rate limit is 10 requests per minute." });
      return;
    }
    next();
  };

  app.post("/register-key", rateLimiterMiddleware, (req, res) => {
    const { userId, publicKey } = req.body;
    if (!userId || !publicKey) {
      res.status(400).json({ success: false, error: "Missing userId or publicKey in request body" });
      return;
    }
    publicKeyRegistry.set(userId, publicKey);
    res.json({ success: true, message: `Public key for '${userId}' registered successfully` });
  });

  app.post("/keys/bundle", rateLimiterMiddleware, requireSessionToken, (req, res) => {
    const { userId, bundle } = req.body;
    if (!userId || !bundle) {
      res.status(400).json({ success: false, error: "Missing userId or bundle in request body" });
      return;
    }
    if (!bundle.identityPublicKey || !bundle.signingIdentityPublicKey || !bundle.signedPrekey || !bundle.signedPreKeySignature) {
      res.status(400).json({
        success: false,
        error: "Bundle must include identityPublicKey, signingIdentityPublicKey, signedPrekey, and signedPreKeySignature",
      });
      return;
    }
    keyBundleRegistry.set(userId, {
      identityPublicKey: bundle.identityPublicKey,
      signingIdentityPublicKey: bundle.signingIdentityPublicKey,
      signedPrekey: bundle.signedPrekey,
      signedPreKeySignature: bundle.signedPreKeySignature,
      oneTimePrekeys: Array.isArray(bundle.oneTimePrekeys) ? [...bundle.oneTimePrekeys] : [],
    });
    res.json({ success: true, message: `Prekey bundle for '${userId}' registered successfully` });
  });

  app.get("/keys/bundle/:userId", (req, res) => {
    const { userId } = req.params;
    const stored = keyBundleRegistry.get(userId);
    if (!stored) {
      res.status(404).json({ success: false, error: `Prekey bundle not found for user '${userId}'` });
      return;
    }
    let oneTimePrekey: string | null = null;
    if (stored.oneTimePrekeys.length > 0) {
      oneTimePrekey = stored.oneTimePrekeys.shift() ?? null;
    }
    res.json({
      userId,
      bundle: {
        identityPublicKey: stored.identityPublicKey,
        signingIdentityPublicKey: stored.signingIdentityPublicKey,
        signedPrekey: stored.signedPrekey,
        signedPreKeySignature: stored.signedPreKeySignature,
        oneTimePrekey,
      },
    });
  });

  app.post("/keys/replenish", rateLimiterMiddleware, requireSessionToken, (req, res) => {
    const { userId, oneTimePrekeys } = req.body;
    if (!userId || !Array.isArray(oneTimePrekeys) || oneTimePrekeys.length === 0) {
      res.status(400).json({ success: false, error: "Missing userId or a non-empty oneTimePrekeys array" });
      return;
    }
    const stored = keyBundleRegistry.get(userId);
    if (!stored) {
      res.status(404).json({ success: false, error: `No existing bundle registered for user '${userId}'` });
      return;
    }
    stored.oneTimePrekeys.push(...oneTimePrekeys);
    res.json({ success: true, totalOneTimePrekeys: stored.oneTimePrekeys.length });
  });

  app.get("/key/:userId", (req, res) => {
    const { userId } = req.params;
    const publicKey = publicKeyRegistry.get(userId);
    if (!publicKey) {
      res.status(404).json({ success: false, error: `Public key not found for user '${userId}'` });
      return;
    }
    res.json({ userId, publicKey });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "skrimchat-signaling", registeredKeysCount: publicKeyRegistry.size });
  });

  // ---------------------------------------------------------------------
  // Mock S3 Presigned URL & S3 Upload endpoints for local preview development
  // ---------------------------------------------------------------------
  app.post("/media/presigned-url", (req, res) => {
    const { path: s3Path } = req.body;
    if (!s3Path) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    // Return a mock upload URL pointing back to our own server
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const uploadUrl = `${protocol}://${host}/media/mock-upload?path=${encodeURIComponent(s3Path)}`;
    res.json({ uploadUrl });
  });

  // Handle raw PUT upload of binary files
  app.put("/media/mock-upload", express.raw({ type: "*/*", limit: "100mb" }), (req, res) => {
    const s3Path = req.query.path as string;
    if (!s3Path) {
      res.status(400).json({ error: "Missing path query parameter" });
      return;
    }
    console.log(`[MOCK S3] Received upload of size ${req.body?.length || 0} bytes for path: ${s3Path}`);
    res.status(200).send("Upload succeeded");
  });

  // ---------------------------------------------------------------------
  // WebSocket Signaling (WebRTC 1:1 / group calling)
  // ---------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Map<string, WebSocket>>();
  const clients = new Map<WebSocket, { roomId: string; userId: string; role?: string }>();
  const lastSequenceMap = new Map<string, number>();

  function broadcastViewerCount(roomId: string) {
    const roomMap = rooms.get(roomId);
    if (!roomMap) return;
    let count = 0;
    roomMap.forEach((memberWs) => {
      const meta = clients.get(memberWs);
      if (meta && meta.role === "viewer") count++;
    });
    roomMap.forEach((memberWs) => {
      if (memberWs.readyState === WebSocket.OPEN) {
        memberWs.send(JSON.stringify({ type: "live-viewer-count-update", count }));
      }
    });
  }

  function handleLeave(ws: WebSocket) {
    const clientMeta = clients.get(ws);
    if (!clientMeta) return;
    const { roomId, userId } = clientMeta;
    clients.delete(ws);
    lastSequenceMap.delete(userId);

    const roomMap = rooms.get(roomId);
    if (roomMap) {
      roomMap.delete(userId);
      roomMap.forEach((memberWs) => {
        if (memberWs.readyState === WebSocket.OPEN) {
          memberWs.send(JSON.stringify({ type: "user-left", userId }));
        }
      });
      broadcastViewerCount(roomId);
      if (roomMap.size === 0) rooms.delete(roomId);
    }
  }

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (messageData: string) => {
      try {
        const message = JSON.parse(messageData);
        const { type } = message;

        switch (type) {
          case "join": {
            const { roomId, userId, role, token } = message;
            if (!roomId || !userId) {
              ws.send(JSON.stringify({ type: "error", message: "roomId and userId are required to join." }));
              return;
            }
            // NOTE: token is required but only checked for presence here.
            // In production, verify against Firebase Auth (admin.auth().verifyIdToken).
            if (!token || typeof token !== "string" || !token.trim()) {
              ws.send(JSON.stringify({ type: "error", message: "Authentication token is required to join." }));
              ws.close();
              return;
            }

            const existing = clients.get(ws);
            if (existing) handleLeave(ws);

            if (!rooms.has(roomId)) rooms.set(roomId, new Map());
            const roomMap = rooms.get(roomId)!;
            roomMap.set(userId, ws);
            clients.set(ws, { roomId, userId, role: role || "normal" });

            const members = Array.from(roomMap.keys()).filter((id) => id !== userId);
            ws.send(JSON.stringify({ type: "joined", roomId, userId, role: role || "normal", members }));

            roomMap.forEach((memberWs, memberId) => {
              if (memberId !== userId && memberWs.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({ type: "user-joined", userId, role: role || "normal" }));
              }
            });

            broadcastViewerCount(roomId);
            break;
          }

          case "leave": {
            handleLeave(ws);
            break;
          }

          case "offer":
          case "answer":
          case "ice-candidate":
          case "call-decline":
          case "hangup": {
            const clientMeta = clients.get(ws);
            if (!clientMeta) {
              ws.send(JSON.stringify({ type: "error", message: "You must join a room first before sending signals." }));
              return;
            }
            const { roomId, userId: senderId } = clientMeta;
            const { targetId, seq, timestamp } = message;

            const lastSeq = lastSequenceMap.get(senderId) || 0;
            if (typeof seq !== "number" || seq <= lastSeq) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid or duplicate sequence number. Signaling message dropped." }));
              return;
            }
            if (!timestamp || typeof timestamp !== "string") {
              ws.send(JSON.stringify({ type: "error", message: "Message timestamp is required." }));
              return;
            }
            const msgTime = new Date(timestamp).getTime();
            if (isNaN(msgTime)) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid timestamp format." }));
              return;
            }
            const ageMs = Date.now() - msgTime;
            if (Math.abs(ageMs) > 30000) {
              ws.send(JSON.stringify({ type: "error", message: "Message timestamp has expired or exceeds 30-second clock skew limit." }));
              return;
            }

            lastSequenceMap.set(senderId, seq);

            const roomMap = rooms.get(roomId);
            if (!roomMap) return;

            const relayPayload = { ...message, senderId };
            if (targetId) {
              const targetWs = roomMap.get(targetId);
              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify(relayPayload));
              }
            } else {
              roomMap.forEach((memberWs, memberId) => {
                if (memberId !== senderId && memberWs.readyState === WebSocket.OPEN) {
                  memberWs.send(JSON.stringify(relayPayload));
                }
              });
            }
            break;
          }

          case "live-chat-message": {
            const clientMeta = clients.get(ws);
            if (clientMeta) {
              const { roomId, userId } = clientMeta;
              const { text } = message;
              const roomMap = rooms.get(roomId);
              if (roomMap) {
                roomMap.forEach((memberWs) => {
                  if (memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify({ type: "live-chat-message", userId, text, timestamp: new Date().toISOString() }));
                  }
                });
              }
            }
            break;
          }

          default: {
            ws.send(JSON.stringify({ type: "error", message: `Unsupported message type: ${type}` }));
          }
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: "error", message: "Malformed message payload." }));
      }
    });

    ws.on("close", () => handleLeave(ws));
    ws.on("error", () => handleLeave(ws));
  });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // ---------------------------------------------------------------------
  // Serve the app (Vite dev middleware locally, static build in prod)
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[skrimchat] Server (app + calling signaling) listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[skrimchat] Server boot failure:", err);
});
