import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ canManage: false });

  const result = await locationService.canManageLocation(authResult.userId, id);
  return NextResponse.json({ canManage: result.success ? result.data : false });
}
