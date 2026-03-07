import { NextRequest, NextResponse } from 'next/server';
import { eventService } from '@/lib/services';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const result = await eventService.getUpcomingEvents(
    {
      locationId: searchParams.get('locationId') || undefined,
      type: searchParams.get('type') || undefined,
      country: searchParams.get('country') || undefined,
    },
    {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    }
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}
