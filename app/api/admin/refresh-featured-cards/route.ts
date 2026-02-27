import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService, featuredCardsService } from '@/lib/services';

/**
 * Admin endpoint to manually refresh featured cards cache
 * Requires super admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user session
    const session = await auth();
    const user = session?.user;

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Check if user is a super admin
    const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');

    if (!roleCheck.success || !roleCheck.data) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    // Trigger the refresh
    console.log(`[Admin] Featured cards refresh triggered by ${user.id} (${user.name})`);
    const result = await featuredCardsService.refreshFeaturedCards();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Featured cards cache refreshed successfully',
      data: result.data
    });

  } catch (error) {
    console.error('[Admin] Featured cards refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
