import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/postgres/db';
import { userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { chooseUploadImageId } from '@/lib/images/ingest-image-ids';

const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

const KEY_COLS = `printing_id, language, collector_number, foiling, edition,
                  is_extended_art, is_front_face, art_variations`;

async function requireSuperAdmin() {
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return { error: 'Unauthorized', status: 401 } as const;
  }
  const rolesResult = await userService.getRoles(authResult.userId);
  if (!rolesResult.success || !rolesResult.data?.isSuperAdmin) {
    return { error: 'Forbidden', status: 403 } as const;
  }
  return { userId: authResult.userId } as const;
}

/** Upload `file` to Cloudflare Images under `imageId`. 5409 (id already
 *  exists) deletes the occupant and retries once — the admin's intent is
 *  explicitly "replace the art for this printing", and the id is derived from
 *  the printing row itself, so the delete stays allowlist-from-printings. */
async function uploadToCloudflare(file: Blob, imageId: string): Promise<{ ok: boolean; error?: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return { ok: false, error: 'Cloudflare credentials not configured' };

  const attempt = async () => {
    const form = new FormData();
    form.append('file', file, `${imageId}.webp`);
    form.append('id', imageId);
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    });
    const json: any = await res.json();
    return { res, json };
  };

  let { res, json } = await attempt();
  const exists = (json?.errors ?? []).some(
    (e: { code: number; message: string }) => e.code === 5409 || /already exists/i.test(e.message),
  );
  if (exists) {
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    ({ res, json } = await attempt());
  }

  if (res.ok && json?.success) return { ok: true };
  return { ok: false, error: JSON.stringify(json?.errors ?? 'upload failed') };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ printingId: string }> },
) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const { printingId } = await params;

  try {
    const rowRes = await pool.query(
      `SELECT ${KEY_COLS} FROM printings WHERE printing_id = $1`,
      [printingId],
    );
    if (!rowRes.rows.length) {
      return NextResponse.json({ error: 'Printing not found' }, { status: 404 });
    }
    const row = rowRes.rows[0];

    // Collision domain: every printing sharing the collector number — a
    // sibling that derives the same key owns it and vetoes the claim.
    const universeRes = await pool.query(
      `SELECT ${KEY_COLS} FROM printings WHERE collector_number = $1`,
      [row.collector_number],
    );

    const chosen = chooseUploadImageId(row, universeRes.rows);

    const uploaded = await uploadToCloudflare(file, chosen.image_id);
    if (!uploaded.ok) {
      return NextResponse.json({ error: `Cloudflare upload failed: ${uploaded.error}` }, { status: 502 });
    }

    const imageUrl = `${CF_BASE}/${chosen.image_id}/public`;
    await pool.query('UPDATE printings SET image_url = $1 WHERE printing_id = $2', [
      imageUrl,
      printingId,
    ]);

    return NextResponse.json({
      success: true,
      data: { imageUrl, imageId: chosen.image_id, fallback: chosen.fallback },
    });
  } catch (error) {
    console.error('[Admin PrintingImage POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
