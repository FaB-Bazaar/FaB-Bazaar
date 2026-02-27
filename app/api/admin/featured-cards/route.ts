import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/postgres/db';
import { siteSettings } from '@/lib/postgres/schema';
import { printingsService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { invalidate } from '@/lib/cache';
import { eq } from 'drizzle-orm';

const FEATURED_CARDS_KEY = 'featured_printing_ids';
const CACHE_KEY = 'featured_cards';

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

export async function GET(_request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, FEATURED_CARDS_KEY))
      .limit(1);

    const printingIds: string[] = rows.length > 0 ? (rows[0].value as string[]) : [];

    // Fetch card previews for the current IDs
    let cards: object[] = [];
    if (printingIds.length > 0) {
      const result = await printingsService.getPrintingsByIds(printingIds, { limit: 50 });
      if (result.success) {
        cards = result.data.printings.map((p) => ({
          printing_id: p.printing_id,
          name: p.name,
          set: p.set,
          foiling: p.foiling,
          rarity: p.rarity,
          tcg_market: p.tcg_market,
          image_url: p.image_url,
        }));
      }
    }

    return NextResponse.json({ success: true, printingIds, cards });
  } catch (error) {
    console.error('[Admin FeaturedCards GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { printingIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { printingIds } = body;
  if (!Array.isArray(printingIds) || !printingIds.every((id) => typeof id === 'string')) {
    return NextResponse.json(
      { error: 'printingIds must be an array of strings' },
      { status: 400 }
    );
  }

  try {
    await db
      .insert(siteSettings)
      .values({ key: FEATURED_CARDS_KEY, value: printingIds })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: printingIds, updatedAt: new Date() },
      });

    await invalidate(CACHE_KEY);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin FeaturedCards PUT]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
