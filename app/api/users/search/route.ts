// app/api/users/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is super admin
    const rolesResult = await userService.getRoles(session.user.id);
    if (!rolesResult.success) {
      return NextResponse.json({ success: false, error: rolesResult.error }, { status: 500 });
    }

    if (!rolesResult.data?.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        users: []
      });
    }

    // Search users by username
    const searchResult = await userService.searchUsers(query, 10);
    if (!searchResult.success) {
      return NextResponse.json({
        success: false,
        error: searchResult.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: searchResult.data.map(u => ({
        _id: u._id,
        username: u.username,
        email: u.email,
        discordUsername: u.discordUsername
      }))
    });

  } catch (error) {
    console.error('[User Search Error]:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to search users'
    }, { status: 500 });
  }
}
