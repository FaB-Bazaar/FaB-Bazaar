// app/api/users/[userId]/binders/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { binderService } from '@/lib/services';

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    const { userId } = await params;

    // Auth.js v5 uses session.user.id
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get binder summaries using service layer
    const result = await binderService.listUserBindersSummary(session.user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to get binders' }, { status: 500 });
    }

    return NextResponse.json({ success: true, binders: result.data });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
