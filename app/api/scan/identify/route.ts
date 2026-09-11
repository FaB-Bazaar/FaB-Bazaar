// app/api/scan/identify/route.ts
// POST /api/scan/identify — the card scanner. Takes one photo of one card
// (multipart `image`, or JSON `{ image: <base64|dataURL> }`), hashes it with
// sharp (lib/scan/image-hash) and ranks it against the printing hash index.
// Returns candidates grouped by card name → pitch → printings; the client
// lets the user pick the exact printing. Signed-in users only.
import { NextRequest, NextResponse } from 'next/server';
import { requireScanAccess } from '@/lib/scan/require-scan-access';
import { scanService } from '@/lib/services';
import { analyzeImage, thumbnailDataUrl } from '@/lib/scan/image-hash';
import { getScanSessionStore, loadOwnedSession } from '@/lib/scan/session-store';
import { pickBetterIdentification } from '@/lib/scan/scan-session';
import { rateLimit } from '@/lib/rate-limit';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

/** Clients downscale before upload (~1000px JPEG ≈ 150KB); this is a hard backstop. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_LIMIT = 5;
const IDENTIFY_PER_MINUTE = 60;

interface Parsed { bytes: Buffer | null; limit: number; session?: string; error?: string; tooLarge?: boolean }

async function parseInput(request: NextRequest): Promise<Parsed> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const file = fd.get('image');
    if (!(file instanceof Blob)) return { bytes: null, limit: DEFAULT_LIMIT, error: 'image file is required' };
    if (file.size > MAX_IMAGE_BYTES) return { bytes: null, limit: DEFAULT_LIMIT, tooLarge: true };
    const limitRaw = fd.get('limit');
    const session = fd.get('session');
    return { bytes: Buffer.from(await file.arrayBuffer()), limit: clampLimit(limitRaw ? Number(limitRaw) : undefined), session: typeof session === 'string' && session ? session : undefined };
  }
  let body: any;
  try { body = await request.json(); } catch { return { bytes: null, limit: DEFAULT_LIMIT, error: 'image is required' }; }
  const raw = typeof body?.image === 'string' ? body.image : '';
  if (!raw) return { bytes: null, limit: DEFAULT_LIMIT, error: 'image is required (multipart file or base64 string)' };
  const b64 = raw.replace(/^data:[^;]+;base64,/, '');
  // 4/3 expansion: reject before decoding anything oversized
  if (b64.length > MAX_IMAGE_BYTES * 4 / 3 + 4) return { bytes: null, limit: DEFAULT_LIMIT, tooLarge: true };
  return { bytes: Buffer.from(b64, 'base64'), limit: clampLimit(body?.limit), session: typeof body?.session === 'string' && body.session ? body.session : undefined };
}

function clampLimit(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : DEFAULT_LIMIT;
  return Math.max(1, Math.min(v, 20));
}

export async function POST(request: NextRequest) {
  const authResult = await requireScanAccess(request, {}, { allowOAuth: true });
  if (!authResult.ok) return authResult.response;

  // sharp decode + Hough + two rankings per photo: bound it per user (in-memory, per-process).
  const limited = await rateLimit({ key: `scan-identify:${authResult.userId}`, limit: IDENTIFY_PER_MINUTE, window: 60_000 });
  if (!limited.success) {
    return NextResponse.json({ error: 'Too many scans — wait a moment and try again' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  let parsed: Parsed;
  try {
    parsed = await parseInput(request);
  } catch {
    return NextResponse.json({ error: 'Could not read the image upload' }, { status: 400 });
  }
  if (parsed.tooLarge) {
    return NextResponse.json({ error: `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }
  if (!parsed.bytes) {
    return NextResponse.json({ error: parsed.error ?? 'image is required' }, { status: 400 });
  }

  // Paired-phone mode: the result is ALSO appended to the desktop's session.
  // Validate ownership before doing any image work.
  let sessionCode: string | null = null;
  if (parsed.session) {
    const owned = await loadOwnedSession(getScanSessionStore(), parsed.session, authResult.userId!);
    if (owned.status !== 200) return NextResponse.json({ error: owned.error }, { status: owned.status });
    sessionCode = owned.record.code;
  }

  // one decode: deskew the card if it can be found, whole-card + art hashes, pitch hint
  let analysis;
  try {
    analysis = await analyzeImage(parsed.bytes);
  } catch {
    return NextResponse.json({ error: 'That file is not a readable image' }, { status: 400 });
  }
  // Deskew is do-no-harm: when a quad was used, the flat frame is matched too and the closer wins.
  const primary = await scanService.identify(analysis.hashes, { limit: parsed.limit, pitchHint: analysis.pitchHint });
  if (!primary.success) return NextResponse.json({ error: primary.error }, { status: 500 });
  let chosen = { result: primary.data, hint: analysis.pitchHint, deskewed: analysis.deskewed };
  if (analysis.deskewed && analysis.flatHashes) {
    const flat = await scanService.identify(analysis.flatHashes, { limit: parsed.limit, pitchHint: analysis.flatPitchHint ?? null });
    if (flat.success) chosen = pickBetterIdentification(chosen, { result: flat.data, hint: analysis.flatPitchHint ?? null, deskewed: false });
  }
  const { hint, deskewed } = chosen;
  const result = { success: true as const, data: chosen.result };

  let sessionItemId: string | undefined;
  if (sessionCode) {
    sessionItemId = randomUUID();
    const thumb = await thumbnailDataUrl(parsed.bytes).catch(() => null);
    await getScanSessionStore().appendItem(sessionCode, {
      id: sessionItemId, createdAt: Date.now(), thumb,
      candidates: result.data.candidates, bestDistance: result.data.bestDistance, pitchHint: hint,
    });
  }
  return NextResponse.json({ success: true, data: { ...result.data, pitchHint: hint, deskewed, ...(sessionItemId ? { sessionItemId } : {}) } });
}
