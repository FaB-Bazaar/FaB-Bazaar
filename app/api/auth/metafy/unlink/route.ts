import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

export async function DELETE(request: NextRequest) {
  const authResult = await authenticateSession();
  if (!authResult.success || !authResult.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const result = await userService.unlinkMetafyAccount(authResult.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
