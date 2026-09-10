// app/api/scan/identify/route.ts
// POST /api/scan/identify — the card scanner. Takes one photo of one card
// (multipart `image`, or JSON `{ image: <base64|dataURL> }`), hashes it with
// sharp (lib/scan/image-hash) and ranks it against the printing hash index.
// Returns candidates grouped by card name → pitch → printings; the client
// lets the user pick the exact printing. Signed-in users only.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { scanService } from '@/lib/services';
import { hashImage, pitchHint } from '@/lib/scan/image-hash';

export const runtime = 'nodejs';

/** Clients downscale before upload (~1000px JPEG ≈ 150KB); this is a hard backstop. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_LIMIT = 5;

interface Parsed { bytes: Buffer | null; limit: number; error?: string; tooLarge?: boolean }

async function parseInput(request: NextRequest): Promise<Parsed> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const file = fd.get('image');
    if (!(file instanceof Blob)) return { bytes: null, limit: DEFAULT_LIMIT, error: 'image file is required' };
    if (file.size > MAX_IMAGE_BYTES) return { bytes: null, limit: DEFAULT_LIMIT, tooLarge: true };
    const limitRaw = fd.get('limit');
    return { bytes: Buffer.from(await file.arrayBuffer()), limit: clampLimit(limitRaw ? Number(limitRaw) : undefined) };
  }
  let body: any;
  try { body = await request.json(); } catch { return { bytes: null, limit: DEFAULT_LIMIT, error: 'image is required' }; }
  const raw = typeof body?.image === 'string' ? body.image : '';
  if (!raw) return { bytes: null, limit: DEFAULT_LIMIT, error: 'image is required (multipart file or base64 string)' };
  const b64 = raw.replace(/^data:[^;]+;base64,/, '');
  // 4/3 expansion: reject before decoding anything oversized
  if (b64.length > MAX_IMAGE_BYTES * 4 / 3 + 4) return { bytes: null, limit: DEFAULT_LIMIT, tooLarge: true };
  return { bytes: Buffer.from(b64, 'base64'), limit: clampLimit(body?.limit) };
}

function clampLimit(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : DEFAULT_LIMIT;
  return Math.max(1, Math.min(v, 20));
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
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

  let hashes, hint;
  try {
    [hashes, hint] = await Promise.all([hashImage(parsed.bytes), pitchHint(parsed.bytes).catch(() => null)]);
  } catch {
    return NextResponse.json({ error: 'That file is not a readable image' }, { status: 400 });
  }

  const result = await scanService.identify(hashes, { limit: parsed.limit, pitchHint: hint });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { ...result.data, pitchHint: hint } });
}
