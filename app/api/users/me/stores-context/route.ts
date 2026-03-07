import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const result = await locationService.getUserStoresContext(authResult.userId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
