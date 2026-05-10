/**
 * GET  /api/leagues/[slug]/events  — list events for a league.
 *                                    Filters private events for non-owners.
 *                                    Optional `?status=upcoming,in_progress` filter.
 * POST /api/leagues/[slug]/events  — create event. League-owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { leagueService } from '@/lib/services';
import type { LeagueEventStatus } from '@/lib/services/contracts/ILeagueService';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const VALID_STATUSES: LeagueEventStatus[] = ['upcoming', 'in_progress', 'complete', 'cancelled'];

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get('status');
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const limit = Number(searchParams.get('limit') ?? 100);
    const offset = Number(searchParams.get('offset') ?? 0);

    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    const viewerUserId = auth.success ? auth.userId : undefined;

    const league = await leagueService.getLeagueBySlug(slug, viewerUserId);
    if (!league.success) {
      const status = league.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: league.error }, { status });
    }

    const statuses = statusRaw
      ? statusRaw.split(',').filter((s): s is LeagueEventStatus =>
          (VALID_STATUSES as string[]).includes(s))
      : undefined;

    const result = await leagueService.listEventsByLeague(league.data.id, {
      viewerUserId,
      status: statuses,
      order,
      limit,
      offset,
    });
    if (!result.success) {
      const status = result.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const auth = await authenticateRequest(req, body, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const league = await leagueService.getLeagueBySlug(slug, auth.userId);
    if (!league.success) {
      const status = league.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: league.error }, { status });
    }

    const result = await leagueService.createEvent(league.data.id, auth.userId!, body);
    if (!result.success) {
      const status = result.code === 'forbidden' ? 403
                   : result.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
