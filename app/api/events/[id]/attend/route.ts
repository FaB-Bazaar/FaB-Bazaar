import { NextRequest, NextResponse } from 'next/server';
import { eventService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const bringingTrades = body.bringingTrades !== false;

  const result = await eventService.attendEvent(id, authResult.userId, bringingTrades);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const result = await eventService.cancelAttendance(id, authResult.userId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
