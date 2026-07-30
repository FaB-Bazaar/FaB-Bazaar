import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/postgres/db';
import { printings } from '@/lib/postgres/schema';
import { userService, printingsService, feedOverridesService } from '@/lib/services';
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
 *
 * Durability: a row-only edit is clobbered by the nightly pipeline (step 005
 * re-upserts printings from the feed) and never reprices (step 002 computes
 * prices from the FEED's product id). So the route first auto-records a
 * feed_overrides row keyed by the printing's identity — collector number,
 * edition, foiling, language, and art_variations (the discriminator from
 * migration 0096; art variants share the other keys) — and only then patches
 * the row for immediate display. If the override write fails, nothing is
 * changed.
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

  const lookup = await printingsService.getPrintingsByIds([printingId]);
  if (!lookup.success) {
    return NextResponse.json({ error: lookup.error }, { status: 500 });
  }
  const row = lookup.data?.printings?.[0] as
    | {
        collector_number: string | null;
        edition: string | null;
        foiling: string | null;
        language?: string | null;
        art_variations?: string[] | null;
      }
    | undefined;
  if (!row) {
    return NextResponse.json({ error: 'Printing not found' }, { status: 404 });
  }

  // Only the fields the caller actually sent go into the override.
  const setFields: Record<string, unknown> = {};
  if (tcgplayerProductId !== undefined) setFields.tcgplayer_product_id = tcgplayerProductId;
  if (tcgplayerUrl !== undefined) setFields.tcgplayer_url = tcgplayerUrl;
  if (tcgplayerSubtypeName !== undefined) setFields.tcgplayer_subtype_name = tcgplayerSubtypeName;

  // Override FIRST: it is the durable half. art_variations uses the row's
  // exact list (empty = only no-variant feed printings) — never a wildcard,
  // which would also patch sibling art variants sharing the match key.
  const override = await feedOverridesService.upsertByMatchKey({
    collectorNumber: (row.collector_number || printingId).toUpperCase(),
    edition: row.edition,
    foiling: row.foiling,
    artVariations: row.art_variations ?? [],
    language: row.language ?? 'en',
    setFields,
    reason: `Manual admin TCGplayer edit (printing ${printingId})`,
    createdBy: auth.userId,
  });
  if (!override.success) {
    return NextResponse.json(
      { error: `Feed override failed, nothing changed: ${override.error}` },
      { status: 500 }
    );
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

    return NextResponse.json({ success: true, data: { overrideId: override.data.id } });
  } catch (error) {
    console.error('[Admin TCGplayer PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
