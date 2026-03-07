import { NextRequest, NextResponse } from 'next/server';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await locationService.getLocationById(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: result.data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const canResult = await locationService.canManageLocation(authResult.userId, id);
  if (!canResult.success || !canResult.data) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const result = await locationService.updateLocation(id, body);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await authenticateRequest(request, {});
  if (!authResult.success) return NextResponse.json({ error: authResult.error }, { status: 401 });

  const canResult = await locationService.canManageLocation(authResult.userId, '*');
  if (!canResult.success || !canResult.data) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await locationService.deleteLocation(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ success: true, data: true });
}
