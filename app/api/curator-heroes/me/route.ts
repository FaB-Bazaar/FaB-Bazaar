import { NextRequest, NextResponse } from 'next/server';
import { curatorHeroAssignmentService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

export async function GET(_request: NextRequest) {
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await curatorHeroAssignmentService.getAssignmentsForUser(authResult.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
