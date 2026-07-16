import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { collectibleService } from '@/lib/services';
import type { CreateCollectibleSubmissionDTO } from '@/lib/services/contracts/ICollectibleService';

/**
 * POST /api/collectibles/submissions — crowdsourced playmat suggestions.
 *
 * Any signed-in user can propose a NEW catalog entry (no collectibleId) or a
 * CORRECTION to an existing one (collectibleId set). Submissions land in a
 * pending queue reviewed by superadmins in /admin/collectibles.
 *
 * allowOAuth so OAuth 2.1 / MCP clients (Volzar) can call it, not just
 * session users.
 */
export async function POST(request: NextRequest) {
  let body: Partial<CreateCollectibleSubmissionDTO> = {};
  try {
    body = await request.json();
  } catch {
    // fall through to validation below
  }

  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!body.collectibleId && (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0)) {
    return NextResponse.json(
      { error: 'name is required when suggesting a new collectible' },
      { status: 400 },
    );
  }
  if (body.year !== undefined && body.year !== null && !Number.isInteger(body.year)) {
    return NextResponse.json({ error: 'year must be a whole number' }, { status: 400 });
  }

  const result = await collectibleService.createSubmission(authResult.userId, {
    collectibleId: body.collectibleId,
    kind: body.kind,
    name: body.name,
    description: body.description,
    imageUrl: body.imageUrl,
    artist: body.artist,
    source: body.source,
    year: body.year ?? undefined,
    notes: body.notes,
  });
  if (!result.success) {
    const code =
      result.error === 'Collectible not found' ? 404
      : /pending submissions/i.test(result.error) ? 429
      : /required|at least one change/i.test(result.error) ? 400
      : 500;
    return NextResponse.json({ error: result.error }, { status: code });
  }

  return NextResponse.json({ success: true, data: result.data });
}
