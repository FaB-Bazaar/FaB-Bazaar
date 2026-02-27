// app/api/global/global-binder-stats/route.ts

import { NextResponse } from 'next/server';
import { binderService } from '@/lib/services';

export async function GET() {
  try {
    // Get binder stats using service layer
    const result = await binderService.getBinderStatsSystemInfo();

    if (!result.success) {
      return NextResponse.json({
        error: 'Internal server error',
        message: result.error || 'Failed to fetch binder statistics'
      }, { status: 500 });
    }

    if (!result.data) {
      return NextResponse.json({
        error: 'Binder stats not found',
        message: 'No binder stats run data available'
      }, { status: 404 });
    }

    // Return the stats directly from service (already formatted)
    return NextResponse.json(result.data);

  } catch (error) {
    console.error('Error fetching binder stats:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to fetch binder statistics'
    }, { status: 500 });
  }
}
