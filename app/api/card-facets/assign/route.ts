import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';
import { requireSignedIn } from '../_auth';

// Generous per-user cap — normal tagging is bursty; this only bounds abuse.
const VOTE_LIMIT = 100;
const VOTE_WINDOW = 60_000; // 1 min

function parseBody(body: unknown): { cardUniqueId: string; tag: string } | null {
  const { cardUniqueId, tag } = (body ?? {}) as Record<string, unknown>;
  if (typeof cardUniqueId !== 'string' || !cardUniqueId || typeof tag !== 'string' || !tag) return null;
  return { cardUniqueId, tag };
}

async function handle(request: NextRequest, op: 'add' | 'remove') {
  const body = await request.json().catch(() => ({}));
  const gate = await requireSignedIn(request, body);
  if (!gate.ok) return gate.response;

  const limited = await rateLimit({ key: `facet-vote:${gate.userId}`, limit: VOTE_LIMIT, window: VOTE_WINDOW });
  if (!limited.success) {
    return NextResponse.json({ error: 'Too many facet votes; slow down.' }, { status: 429 });
  }

  const parsed = parseBody(body);
  if (!parsed) return NextResponse.json({ error: 'cardUniqueId and tag are required' }, { status: 400 });

  const result =
    op === 'add'
      ? await facetService.voteCardFacetTag(parsed.cardUniqueId, parsed.tag, gate.userId)
      : await facetService.unvoteCardFacetTag(parsed.cardUniqueId, parsed.tag, gate.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

// POST /api/card-facets/assign — cast the caller's community vote for a tag.
export async function POST(request: NextRequest) {
  return handle(request, 'add');
}

// DELETE /api/card-facets/assign — retract the caller's community vote.
export async function DELETE(request: NextRequest) {
  return handle(request, 'remove');
}
