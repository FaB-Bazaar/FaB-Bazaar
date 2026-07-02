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
// allowOAuth: called by the create_event MCP tool with a bearer token
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const canResult = await locationService.canManageLocation(authResult.userId, id);
  if (!canResult.success || !canResult.data) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  // Drizzle timestamp columns expect Date objects; JSON delivers ISO strings.
  const payload = {
    ...body,
    locationId: id,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
  };
  const result = await eventService.createEvent(payload, authResult.userId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
