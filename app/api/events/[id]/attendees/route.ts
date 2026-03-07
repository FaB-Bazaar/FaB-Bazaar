import { NextRequest, NextResponse } from 'next/server';
import { eventService } from '@/lib/services';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await eventService.getEventAttendees(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
