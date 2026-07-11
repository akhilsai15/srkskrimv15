// server.ts
// Unified dev/production server for SkrimChat (app-only, signaling removed).
//
import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Enable JSON body parsing for API requests
  app.use(express.json());

  // Lazy initialization of S3Client to prevent crashing on boot if credentials are empty or missing
  let s3Client: S3Client | null = null;
  function getS3Client() {
    if (!s3Client) {
      const region = process.env.AWS_REGION || "us-east-1";
      s3Client = new S3Client({ region });
    }
    return s3Client;
  }

  // ---------------------------------------------------------------------
  // S3 Presigned URL endpoint for direct client uploads
  // ---------------------------------------------------------------------
  app.post("/media/presigned-url", async (req, res) => {
    const { path: s3Path, contentType } = req.body;
    if (!s3Path) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    try {
      const bucket = process.env.S3_BUCKET;
      if (!bucket) {
        throw new Error("S3_BUCKET environment variable is not defined");
      }
      const client = getS3Client();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: s3Path,
        ContentType: contentType || "application/octet-stream",
      });
      // 5 minutes expiry
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
      res.json({ uploadUrl });
    } catch (err: any) {
      console.error("Error generating presigned URL:", err);
      res.status(500).json({ error: err.message || "Failed to generate presigned URL" });
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
    console.log(`[skrimchat] Server (app-only) listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[skrimchat] Server boot failure:", err);
});
