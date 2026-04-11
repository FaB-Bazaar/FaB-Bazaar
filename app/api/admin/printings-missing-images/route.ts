import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/postgres/db';
import { printings, cards } from '@/lib/postgres/schema';
import { userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { eq, ilike, and, count, asc } from 'drizzle-orm';

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

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || '';
  const set = searchParams.get('set') || '';
  const edition = searchParams.get('edition') || '';
  const foiling = searchParams.get('foiling') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 100;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (name.trim()) conditions.push(ilike(cards.name, `%${name.trim()}%`));
  if (set.trim()) conditions.push(eq(printings.set, set.trim().toLowerCase()));
  if (edition.trim()) conditions.push(eq(printings.edition, edition.trim().toLowerCase()));
  if (foiling.trim()) conditions.push(eq(printings.foiling, foiling.trim().toLowerCase()));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const rows = await db
      .select({
        printingId: printings.printingId,
        name: cards.name,
        set: printings.set,
        edition: printings.edition,
        foiling: printings.foiling,
        rarity: printings.rarity,
        collectorNumber: printings.collectorNumber,
        pitch: cards.pitch,
        foilInsetTop: printings.foilInsetTop,
        foilInsetRight: printings.foilInsetRight,
        foilInsetBottom: printings.foilInsetBottom,
        foilInsetLeft: printings.foilInsetLeft,
        foilInsetRound: printings.foilInsetRound,
      })
      .from(printings)
      .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(whereClause)
      .orderBy(asc(printings.collectorNumber), asc(cards.name))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ count: count() })
      .from(printings)
      .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(whereClause);

    return NextResponse.json({
      success: true,
      data: {
        printings: rows,
        total: Number(totalRow.count),
        page,
        pages: Math.ceil(Number(totalRow.count) / limit),
      },
    });
  } catch (error) {
    console.error('[Admin ImageUploads GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
