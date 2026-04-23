import { NextResponse } from 'next/server';
import { customTokenCardService } from '@/lib/services';

/**
 * GET /api/creators/[slug]
 *
 * Public. Returns the creator profile and their published token cards
 * (hydrated with linked card metadata) in a single response.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const creatorResult = await customTokenCardService.getCreatorBySlug(slug);
  if (!creatorResult.success) {
    return NextResponse.json({ error: creatorResult.error }, { status: 500 });
  }
  if (!creatorResult.data) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  const tokenCardsResult = await customTokenCardService.getPublishedTokenCardsByCreator(creatorResult.data.id);
  if (!tokenCardsResult.success) {
    return NextResponse.json({ error: tokenCardsResult.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: { creator: creatorResult.data, tokenCards: tokenCardsResult.data },
  });
}
