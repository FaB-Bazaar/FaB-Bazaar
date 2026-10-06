import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { setsService } from '@/lib/services';
import { uploadSetLogo } from '@/lib/images/set-logo-upload';
import { refreshSetOverlay } from '@/lib/fab-constants/set-overlay-server';
import { CF_IMAGE_BASE } from '@/lib/import/cardvault-job';

const MAX_BYTES = 10 * 1024 * 1024;
// No SVG: it can carry script, and set logos are raster banners anyway.
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * POST /api/admin/cardvault/sets/[code]/logo — multipart `file`. Uploads the
 * set logo to Cloudflare Images, records sets.image_id and refreshes the
 * runtime set overlay so /sets and the set pickers show it (superadmin).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  const code = (await params).code.toLowerCase();

  const set = await setsService.getSetByCode(code);
  if (!set.success) return NextResponse.json({ error: set.error }, { status: 500 });
  if (!set.data) return NextResponse.json({ error: `unknown set '${code}'` }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: 'Choose an image file' }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: 'Use a PNG, JPEG, WebP or GIF image' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'The image must be 10 MB or smaller' }, { status: 400 });

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return NextResponse.json({ error: 'Cloudflare is not configured on this server' }, { status: 503 });

  const uploaded = await uploadSetLogo({ code, file, cloudflare: { accountId, apiToken } });
  if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: 502 });

  const updated = await setsService.updateSet(code, { imageId: uploaded.imageId });
  if (!updated.success) return NextResponse.json({ error: updated.error }, { status: 500 });
  await refreshSetOverlay();
  return NextResponse.json({ success: true, data: { imageId: uploaded.imageId, url: `${CF_IMAGE_BASE}/${uploaded.imageId}/public` } });
}
