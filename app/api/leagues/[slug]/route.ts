/**
 * GET    /api/leagues/[slug]  — fetch one league. Anonymous viewers only
 *                               see public leagues; authenticated owners
 *                               can see their own private leagues.
 * PATCH  /api/leagues/[slug]  — update fields. Owner only.
 * DELETE /api/leagues/[slug]  — delete the league (cascades to events
 *                               and result rows). Owner only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { leagueService } from '@/lib/services';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    const viewerUserId = auth.success ? auth.userId : undefined;

    const result = await leagueService.getLeagueBySlug(slug, viewerUserId);
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

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const auth = await authenticateRequest(req, body, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Resolve slug → id (the service mutation methods key on id)
    const existing = await leagueService.getLeagueBySlug(slug, auth.userId);
    if (!existing.success) {
      const status = existing.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: existing.error }, { status });
    }

    const result = await leagueService.updateLeague(existing.data.id, auth.userId!, body);
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
    const { slug } = await params;
    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const existing = await leagueService.getLeagueBySlug(slug, auth.userId);
    if (!existing.success) {
      const status = existing.code === 'not_found' ? 404 : 500;
      return NextResponse.json({ success: false, error: existing.error }, { status });
    }

    const result = await leagueService.deleteLeague(existing.data.id, auth.userId!);
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
