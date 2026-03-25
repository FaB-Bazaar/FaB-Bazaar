import { NextRequest, NextResponse } from 'next/server';
import { curatorHeroAssignmentService } from '@/lib/services';

export async function GET(request: NextRequest) {
  const heroName = request.nextUrl.searchParams.get('heroName');
  if (!heroName) {
    return NextResponse.json({ error: 'heroName is required' }, { status: 400 });
  }

  const result = await curatorHeroAssignmentService.getAssignmentsForHero(heroName);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
