import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/postgres/db';
import { printings } from '@/lib/postgres/schema';
import { userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { and, eq, isNull, sql } from 'drizzle-orm';

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

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { set, foiling, isExtendedArt, artVariations, overwrite, top, right, bottom, left, round } = body as Record<string, unknown>;

  if (typeof set !== 'string' || !set) {
    return NextResponse.json({ error: 'set is required' }, { status: 400 });
  }
  if (typeof foiling !== 'string' || !foiling) {
    return NextResponse.json({ error: 'foiling is required' }, { status: 400 });
  }
  for (const [field, val] of [['top', top], ['right', right], ['bottom', bottom], ['left', left]] as const) {
    if (typeof val !== 'number' || val < 0 || val > 100) {
      return NextResponse.json({ error: `${field} must be a number between 0 and 100` }, { status: 400 });
    }
  }
  if (typeof round !== 'string' || round.length > 20) {
    return NextResponse.json({ error: 'round must be a short CSS length string' }, { status: 400 });
  }

  try {
    const conditions = [
      eq(printings.set, set.toLowerCase()),
      eq(printings.foiling, foiling.toLowerCase()),
    ];

    if (typeof isExtendedArt === 'boolean') {
      conditions.push(eq(printings.isExtendedArt, isExtendedArt));
    }

    // Exact art_variations array match so EA+AA only hits EA+AA cards, not EA-only
    if (Array.isArray(artVariations)) {
      const sorted = [...artVariations as string[]].sort();
      conditions.push(sql`art_variations = ARRAY[${sql.join(sorted.map(v => sql`${v}`), sql`, `)}]::text[]`);
    }

    // Without overwrite: skip cards that already have a mask
    if (!overwrite) {
      conditions.push(isNull(printings.foilInsetBottom));
    }

    const result = await db
      .update(printings)
      .set({
        foilInsetTop:    top    as number,
        foilInsetRight:  right  as number,
        foilInsetBottom: bottom as number,
        foilInsetLeft:   left   as number,
        foilInsetRound:  round  as string,
        updatedAt: new Date(),
      })
      .where(and(...conditions));

    return NextResponse.json({ success: true, updated: result.rowCount ?? 0 });
  } catch (error) {
    console.error('[Admin FoilMask Bulk POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
