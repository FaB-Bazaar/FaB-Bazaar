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

/**
 * PATCH /api/admin/printings/[printingId]/tcgplayer
 *
 * Update TCGplayer metadata for a printing.
 *
 * Body (all fields optional — only supplied fields are updated):
 * {
 *   "tcgplayerProductId": "657480",
 *   "tcgplayerUrl": "https://www.tcgplayer.com/product/657480/...",
 *   "tcgplayerSubtypeName": "Rainbow Foil" | "Cold Foil" | null
 * }
 */
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

  const { tcgplayerProductId, tcgplayerUrl, tcgplayerSubtypeName } = body as Record<string, unknown>;

  // Validate productId — must be null, undefined, or a string of digits
  if (tcgplayerProductId !== undefined && tcgplayerProductId !== null) {
    if (typeof tcgplayerProductId !== 'string' || !/^\d+$/.test(tcgplayerProductId)) {
      return NextResponse.json({ error: 'tcgplayerProductId must be a numeric string' }, { status: 400 });
    }
  }

  if (tcgplayerUrl !== undefined && tcgplayerUrl !== null) {
    if (typeof tcgplayerUrl !== 'string' || tcgplayerUrl.length > 500) {
      return NextResponse.json({ error: 'tcgplayerUrl must be a string under 500 chars' }, { status: 400 });
    }
    if (!tcgplayerUrl.startsWith('https://www.tcgplayer.com/')) {
      return NextResponse.json({ error: 'tcgplayerUrl must be a tcgplayer.com URL' }, { status: 400 });
    }
  }

  const VALID_SUBTYPES = ['Rainbow Foil', 'Cold Foil', null];
  if (tcgplayerSubtypeName !== undefined && !VALID_SUBTYPES.includes(tcgplayerSubtypeName as string | null)) {
    return NextResponse.json({ error: 'tcgplayerSubtypeName must be "Rainbow Foil", "Cold Foil", or null' }, { status: 400 });
  }

  if (tcgplayerProductId === undefined && tcgplayerUrl === undefined && tcgplayerSubtypeName === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    await db
      .update(printings)
      .set({
        tcgplayerProductId:  tcgplayerProductId  !== undefined ? (tcgplayerProductId  as string | null) : undefined,
        tcgplayerUrl:        tcgplayerUrl        !== undefined ? (tcgplayerUrl        as string | null) : undefined,
        tcgplayerSubtypeName: tcgplayerSubtypeName !== undefined ? (tcgplayerSubtypeName as string | null) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(printings.printingId, printingId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin TCGplayer PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
