import { NextRequest, NextResponse } from 'next/server';
import { foilMaskService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

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
 * Three shapes, one endpoint:
 *
 *   { dryRun: true, foiling, set?, ... }      → preview counts + sample, no write
 *   { printingIds: [...], top, ... }          → apply to exactly those printings
 *   { foiling, set?, ..., top, ... }          → criteria sweep (unset rows only)
 *
 * Every applying call records an undoable op; see PostgresFoilMaskService.
 */
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
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const {
    printingIds,
    set,
    foiling,
    isExtendedArt,
    artVariations,
    dryRun,
    description,
    top, right, bottom, left, round,
  } = body as Record<string, unknown>;

  const isSelection = Array.isArray(printingIds);

  if (!isSelection && (typeof foiling !== 'string' || !foiling)) {
    return NextResponse.json(
      { error: 'Provide either printingIds or a foiling to match on' },
      { status: 400 }
    );
  }
  if (set !== undefined && set !== null && typeof set !== 'string') {
    return NextResponse.json({ error: 'set must be a string' }, { status: 400 });
  }

  const criteria = {
    set: typeof set === 'string' ? set : null,
    foiling: foiling as string,
    ...(typeof isExtendedArt === 'boolean' ? { isExtendedArt } : {}),
    ...(Array.isArray(artVariations) ? { artVariations: artVariations as string[] } : {}),
  };

  // Preview first — a dry run must never reach an apply path.
  if (dryRun === true) {
    const preview = await foilMaskService.previewMatch(criteria);
    if (!preview.success) {
      return NextResponse.json({ error: preview.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: preview.data });
  }

  const values = {
    top: top as number,
    right: right as number,
    bottom: bottom as number,
    left: left as number,
    round: round as string,
  };
  const options = {
    userId: auth.userId,
    ...(typeof description === 'string' && description ? { description } : {}),
  };

  const result = isSelection
    ? await foilMaskService.applyToSelection(printingIds as string[], values, options)
    : await foilMaskService.applyToMatch(criteria, values, options);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    // `updated` is kept at the top level for the existing client toast.
    updated: result.data.updated,
    data: result.data,
  });
}
