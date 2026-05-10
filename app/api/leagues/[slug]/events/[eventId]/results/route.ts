/**
 * GET  /api/leagues/[slug]/events/[eventId]/results
 *        — list result rows (deck submissions / placings) for an event.
 *          Privacy: hidden when either the event or its league is private
 *          unless the viewer is the league owner.
 *
 * POST /api/leagues/[slug]/events/[eventId]/results
 *        — record a result row. League-owner only.
 *          hero_name auto-fills from decks.heroName when deckId is set
 *          and no explicit heroName was passed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { leagueService } from '@/lib/services';

interface RouteContext {
  params: Promise<{ slug: string; eventId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { eventId } = await params;
    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    const viewerUserId = auth.success ? auth.userId : undefined;

    const result = await leagueService.listEventResults(eventId, viewerUserId);
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
    const { eventId } = await params;
    const body = await req.json();
    const auth = await authenticateRequest(req, body, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const result = await leagueService.addEventResult(eventId, auth.userId!, body);
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
