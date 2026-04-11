import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/postgres/db';
import { printings } from '@/lib/postgres/schema';
import { userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { eq } from 'drizzle-orm';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ printingId: string }> }
) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { printingId } = await params;
  if (!printingId) {
    return NextResponse.json({ error: 'printingId required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { top, right, bottom, left, round } = body as Record<string, unknown>;

  // Validate numeric insets — must be null or a number in [0, 100]
  for (const [field, val] of [['top', top], ['right', right], ['bottom', bottom], ['left', left]] as const) {
    if (val !== null && val !== undefined) {
      if (typeof val !== 'number' || val < 0 || val > 100) {
        return NextResponse.json({ error: `${field} must be a number between 0 and 100` }, { status: 400 });
      }
    }
  }

  // round is a short CSS value like "1.5%", "0%", "8px" — basic sanity check
  if (round !== null && round !== undefined) {
    if (typeof round !== 'string' || round.length > 20) {
      return NextResponse.json({ error: 'round must be a short CSS length string' }, { status: 400 });
    }
  }

  try {
    await db
      .update(printings)
      .set({
        foilInsetTop:    top    !== undefined ? (top    as number | null) : undefined,
        foilInsetRight:  right  !== undefined ? (right  as number | null) : undefined,
        foilInsetBottom: bottom !== undefined ? (bottom as number | null) : undefined,
        foilInsetLeft:   left   !== undefined ? (left   as number | null) : undefined,
        foilInsetRound:  round  !== undefined ? (round  as string | null) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(printings.printingId, printingId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin FoilMask PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
