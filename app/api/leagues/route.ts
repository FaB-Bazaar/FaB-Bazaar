/**
 * GET  /api/leagues          — list public leagues for the directory.
 *                              Authenticated users can additionally pass
 *                              `?mine=true` to list leagues they own.
 * POST /api/leagues          — create a new league (curator or superadmin only).
 *
 * Visibility filtering and ownership enforcement live in the service.
 * This route only handles role gating for creation and authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { leagueService, userService } from '@/lib/services';
import { statusFor } from '@/lib/api/result-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === 'true';
    const limit = Number(searchParams.get('limit') ?? 100);
    const offset = Number(searchParams.get('offset') ?? 0);

    let ownerId: string | undefined;
    if (mine) {
      const auth = await authenticateRequest(req, {}, { allowOAuth: true });
      if (!auth.success) {
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
      }
      ownerId = auth.userId!;
    }

    const result = await leagueService.listLeagues({
      publicOnly: !mine,                  // owners see their private leagues too
      ownerId,
      limit,
      offset,
    });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const auth = await authenticateRequest(req, body, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const [curatorCheck, adminCheck] = await Promise.all([
      userService.hasRole(auth.userId!, 'isCurator'),
      userService.hasRole(auth.userId!, 'isSuperAdmin'),
    ]);
    const isCurator = !!(curatorCheck.success && curatorCheck.data);
    const isSuperAdmin = !!(adminCheck.success && adminCheck.data);
    if (!isCurator && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Curator or Super Admin role required' }, { status: 403 });
    }

    const result = await leagueService.createLeague(auth.userId!, body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: statusFor(result.code) });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
