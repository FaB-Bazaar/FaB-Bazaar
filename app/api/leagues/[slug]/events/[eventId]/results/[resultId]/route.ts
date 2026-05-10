/**
 * PATCH  /api/leagues/[slug]/events/[eventId]/results/[resultId]  — owner only
 * DELETE /api/leagues/[slug]/events/[eventId]/results/[resultId]  — owner only
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { leagueService } from '@/lib/services';

interface RouteContext {
  params: Promise<{ slug: string; eventId: string; resultId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { resultId } = await params;
    const body = await req.json();
    const auth = await authenticateRequest(req, body, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const result = await leagueService.updateEventResult(resultId, auth.userId!, body);
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
    const { resultId } = await params;
    const auth = await authenticateRequest(req, {}, { allowOAuth: true });
    if (!auth.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const result = await leagueService.deleteEventResult(resultId, auth.userId!);
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
