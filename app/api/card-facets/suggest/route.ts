import { NextRequest, NextResponse } from 'next/server';
import { facetService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';
import type { FacetDimension } from '@/lib/services/contracts/IFacetService';
import { requireSignedIn } from '../_auth';

// Suggestions are cheap to spam and expensive to moderate — keep the cap tight.
const SUGGEST_LIMIT = 10;
const SUGGEST_WINDOW = 3_600_000; // 1 hour

const DIMENSIONS: FacetDimension[] = ['mechanical', 'strategic', 'synergy'];

// POST /api/card-facets/suggest — propose a new vocabulary term (lands as pending).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const gate = await requireSignedIn(request, body);
  if (!gate.ok) return gate.response;

  const limited = await rateLimit({ key: `facet-suggest:${gate.userId}`, limit: SUGGEST_LIMIT, window: SUGGEST_WINDOW });
  if (!limited.success) {
    return NextResponse.json({ error: 'Too many suggestions; try again later.' }, { status: 429 });
  }

  const { dim, label, def, proposedId, rationale } = (body ?? {}) as Record<string, unknown>;
  if (typeof label !== 'string' || !label.trim() || typeof dim !== 'string' || !DIMENSIONS.includes(dim as FacetDimension)) {
    return NextResponse.json({ error: 'A label and a valid dim (mechanical|strategic|synergy) are required' }, { status: 400 });
  }

  const result = await facetService.createSuggestion({
    dim: dim as FacetDimension,
    label,
    def: typeof def === 'string' ? def : undefined,
    proposedId: typeof proposedId === 'string' ? proposedId : undefined,
    rationale: typeof rationale === 'string' ? rationale : undefined,
    proposedBy: gate.userId,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
