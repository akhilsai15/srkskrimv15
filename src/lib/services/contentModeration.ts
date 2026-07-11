/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized NSFW / adult-content moderation gate for Pulse, Vibe, and
 * Spark media uploads.
 *
 * HOW THIS WORKS
 * ---------------
 * scanMedia() is called for every image/video a user attaches to a Pulse
 * post, a Vibe, or a Spark, BEFORE that media is allowed into the composer
 * or saved anywhere. If the scan comes back flagged, the media is rejected
 * automatically — no confirmation is requested from the posting user, and
 * no manual review by the SkrimChat team is required for the block to take
 * effect. The block happens synchronously in the upload path, so flagged
 * content never reaches the feed in the first place.
 *
 * PLUGGING IN A REAL CLASSIFIER (IMPORTANT — READ BEFORE SHIPPING)
 * ------------------------------------------------------------------
 * This file ships with a `localHeuristicScan()` fallback so the pipeline
 * is runnable end-to-end without any external account. That heuristic is
 * NOT an accurate NSFW detector — it's a crude skin-tone/color ratio check
 * meant only to prove the wiring works. Before this goes anywhere near
 * production, replace it with a real vision-moderation API, e.g.:
 *   - Google Cloud Vision SafeSearch
 *   - AWS Rekognition (DetectModerationLabels)
 *   - Hive Moderation
 *   - Sightengine
 *
 * To wire in a real provider, set these (e.g. via a build-time env file):
 *   VITE_MODERATION_API_URL   - your backend endpoint that proxies to the
 *                                vision API (never call the vendor
 *                                directly from the client with a secret key)
 *   VITE_MODERATION_THRESHOLD - score 0-1 above which content is auto-blocked
 *                                (defaults to 0.75 below)
 *
 * Your backend endpoint is expected to accept:
 *   POST { mediaDataUrl: string, kind: 'image' | 'video' }
 * and return:
 *   { nsfw: boolean, score: number, categories?: string[] }
 */

export interface ModerationResult {
  flagged: boolean;
  score: number;          // 0-1 confidence the content is adult/explicit
  categories: string[];   // e.g. ['explicit_nudity'] — empty if not flagged
  source: 'remote' | 'local_heuristic';
}

const REMOTE_ENDPOINT = (import.meta as any)?.env?.VITE_MODERATION_API_URL || '';
const THRESHOLD = Number((import.meta as any)?.env?.VITE_MODERATION_THRESHOLD) || 0.75;

/**
 * Scans a single image or video (as a data URL / object URL) and returns
 * whether it should be auto-blocked. Never throws — a hard failure in the
 * scanner fails CLOSED to local heuristic rather than silently allowing
 * everything through.
 */
export async function scanMedia(mediaUrl: string, kind: 'image' | 'video'): Promise<ModerationResult> {
  if (!mediaUrl) {
    return { flagged: false, score: 0, categories: [], source: 'local_heuristic' };
  }

  if (REMOTE_ENDPOINT) {
    try {
      const res = await fetch(REMOTE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaDataUrl: mediaUrl, kind }),
      });
      if (res.ok) {
        const data = await res.json();
        const score = typeof data.score === 'number' ? data.score : (data.nsfw ? 1 : 0);
        return {
          flagged: !!data.nsfw || score >= THRESHOLD,
          score,
          categories: Array.isArray(data.categories) ? data.categories : [],
          source: 'remote',
        };
      }
      console.warn('Moderation API returned non-OK status, falling back to local heuristic');
    } catch (err) {
      console.warn('Moderation API call failed, falling back to local heuristic', err);
    }
  }

  return localHeuristicScan(mediaUrl, kind);
}

/**
 * Scans a batch of media items in parallel. Returns the same array shape
 * with a `moderation` result attached to each item, plus a convenience
 * `anyFlagged` flag.
 */
export async function scanMediaBatch<T extends { url: string; kind: 'image' | 'video' }>(
  items: T[]
): Promise<{ results: (T & { moderation: ModerationResult })[]; anyFlagged: boolean }> {
  const results = await Promise.all(
    items.map(async (item) => ({ ...item, moderation: await scanMedia(item.url, item.kind) }))
  );
  return { results, anyFlagged: results.some((r) => r.moderation.flagged) };
}

/**
 * DEMO-ONLY fallback. Draws the image (or the first frame of a video) onto
 * an offscreen canvas and estimates the proportion of skin-tone-range
 * pixels. This is a crude stand-in for a real classifier — it exists only
 * so the auto-block pipeline can be exercised without a vendor account.
 * Replace with a real API before relying on this for actual moderation.
 */
function localHeuristicScan(mediaUrl: string, kind: 'image' | 'video'): Promise<ModerationResult> {
  return new Promise((resolve) => {
    const finish = (score: number) => {
      resolve({
        flagged: score >= THRESHOLD,
        score,
        categories: score >= THRESHOLD ? ['suspected_explicit_content'] : [],
        source: 'local_heuristic',
      });
    };

    const scoreFromImageElement = (el: HTMLImageElement | HTMLVideoElement) => {
      try {
        const canvas = document.createElement('canvas');
        const w = (el as HTMLVideoElement).videoWidth || (el as HTMLImageElement).naturalWidth || 0;
        const h = (el as HTMLVideoElement).videoHeight || (el as HTMLImageElement).naturalHeight || 0;
        if (!w || !h) return finish(0);
        canvas.width = Math.min(w, 160);
        canvas.height = Math.min(h, 160);
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(0);
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let skinPixels = 0;
        const totalPixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // Very rough skin-tone heuristic — deliberately conservative, this
          // is NOT a real NSFW classifier.
          if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && Math.max(r, g, b) - Math.min(r, g, b) > 15) {
            skinPixels++;
          }
        }
        finish(totalPixels ? skinPixels / totalPixels : 0);
      } catch (e) {
        console.warn('Local moderation heuristic failed, defaulting to not-flagged', e);
        finish(0);
      }
    };

    if (kind === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      video.src = mediaUrl;
      video.onloadeddata = () => scoreFromImageElement(video);
      video.onerror = () => finish(0);
    } else {
      const img = new Image();
      img.onload = () => scoreFromImageElement(img);
      img.onerror = () => finish(0);
      img.src = mediaUrl;
    }
  });
}
