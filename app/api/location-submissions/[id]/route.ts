import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

async function requireAdmin(request: NextRequest) {
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return { error: authResult.error, status: 401 };
  const canResult = await locationService.canManageLocation(authResult.userId, '*');
  if (!canResult.success || !canResult.data) return { error: 'Forbidden', status: 403 };
  return { userId: authResult.userId };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const result = await locationService.getSubmission(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: result.data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAdmin(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { action, reason } = await request.json();

  if (action === 'approve') {
    const result = await locationService.approveSubmission(id, auth.userId!);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ success: true, data: result.data });
  }

  if (action === 'reject') {
    const result = await locationService.rejectSubmission(id, auth.userId!, reason || '');
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ success: true, data: result.data });
  }

  return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
}
