import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, userService } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const heroName = searchParams.get('heroName');
    const viewPublic = searchParams.get('view') === 'public';

    // Try to authenticate — if it fails, return only published lists
    const authResult = await authenticateRequest(req, {});

    if (authResult.success && !viewPublic) {
      // Check if user is curator or superadmin
      const userResult = await userService.getProfile(authResult.userId!);
      const profile = userResult.success ? userResult.data : null;
      const isCurator = profile?.isCurator || false;
      const isSuperAdmin = profile?.roles?.isSuperAdmin || false;

      if (isCurator || isSuperAdmin) {
        // Return all lists (including unpublished) for admins
        const result = await curatedListService.getAllLists();
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: result.data });
      }
    }

    // Public: return published lists with cards, filtered by hero (or generic only if no hero)
    const result = await curatedListService.getPublishedListsForHero(heroName ?? undefined);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const authResult = await authenticateRequest(req, body);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userResult = await userService.getProfile(authResult.userId!);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    const profile = userResult.data;
    const isCurator = profile.isCurator || false;
    const isSuperAdmin = profile.roles?.isSuperAdmin || false;

    if (!isCurator && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Curator or Super Admin role required' }, { status: 403 });
    }

    const { name, description, heroName, format, tags, sortOrder, parentId, variantType } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const result = await curatedListService.createList(authResult.userId!, {
      name,
      description,
      heroName,
      format,
      tags,
      sortOrder,
      parentId,
      variantType,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
