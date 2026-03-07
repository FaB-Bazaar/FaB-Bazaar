import { NextRequest, NextResponse } from 'next/server';
import { eventService, locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await eventService.getEventById(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: result.data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const eventResult = await eventService.getEventById(id);
  if (!eventResult.success || !eventResult.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const canResult = await locationService.canManageLocation(authResult.userId, eventResult.data.locationId);
  if (!canResult.success || !canResult.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const result = await eventService.updateEvent(id, body);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const eventResult = await eventService.getEventById(id);
  if (!eventResult.success || !eventResult.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const canResult = await locationService.canManageLocation(authResult.userId, eventResult.data.locationId);
  if (!canResult.success || !canResult.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await eventService.deleteEvent(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: true });
}
