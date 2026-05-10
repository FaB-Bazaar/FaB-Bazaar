/**
 * GET    /api/leagues/[slug]/events/[eventId]
 * PATCH  /api/leagues/[slug]/events/[eventId]   — league-owner only
 * DELETE /api/leagues/[slug]/events/[eventId]   — league-owner only
 *
 * Slug isn't strictly required (eventId is unique), but it keeps URLs
 * tidy and lets us validate that the event belongs to the named league
 * for nicer 404s.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { leagueService } from '@/lib/services';

interface RouteContext {
  params: Promise<{ slug: string; eventId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { slug, eventId } = await params;
    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    const viewerUserId = auth.success ? auth.userId : undefined;

    const result = await leagueService.getEvent(eventId, viewerUserId);
    if (!result.success) {
      const status = result.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    // Sanity check that the event belongs to this league slug
    const league = await leagueService.getLeagueBySlug(slug, viewerUserId);
    if (!league.success || league.data.id !== result.data.leagueId) {
      return NextResponse.json({ success: false, error: 'event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const auth = await authenticateRequest(req, body, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const result = await leagueService.updateEvent(eventId, auth.userId!, body);
    if (!result.success) {
      const status = result.code === 'forbidden' ? 403
                   : result.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { eventId } = await params;
    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const result = await leagueService.deleteEvent(eventId, auth.userId!);
    if (!result.success) {
      const status = result.code === 'forbidden' ? 403
                   : result.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
