import { NextRequest, NextResponse } from 'next/server';
import { eventService, locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeEnded = searchParams.get('includeEnded') === 'true';

  const result = await eventService.getEventsAtLocation(id, { includeEnded });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}

// POST — create event at this location (managers + admins)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const canResult = await locationService.canManageLocation(authResult.userId, id);
  if (!canResult.success || !canResult.data) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const result = await eventService.createEvent({ ...body, locationId: id }, authResult.userId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
