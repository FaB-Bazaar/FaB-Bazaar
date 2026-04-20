import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');
    if (!roleCheck.success || !roleCheck.data) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    console.log(`[Admin] Kits cache refresh triggered by ${user.id} (${user.name})`);
    revalidateTag('kits-summary');

    return NextResponse.json({
      success: true,
      message: 'Kits cache invalidated — the /kits page will regenerate on next visit.',
    });
  } catch (error) {
    console.error('[Admin] Kits cache refresh error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
