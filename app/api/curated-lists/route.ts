import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { curatedListService, curatorHeroAssignmentService, userService } from '@/lib/services';
import { getHeroInfo } from '@/lib/fab-constants/heroes';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const heroNameRaw = searchParams.get('heroName');
    const viewPublic = searchParams.get('view') === 'public';

    // Resolve input to canonical lowercase hero key (handles nicknames/shortnames/casing).
    // Falls back to the raw trimmed lowercase string if no hero matches.
    const heroFilter = heroNameRaw?.trim()
      ? (getHeroInfo(heroNameRaw)?.name ?? heroNameRaw.trim().toLowerCase())
      : null;
    const filterByHero = <T extends { heroName?: string | null }>(lists: T[]): T[] =>
      heroFilter ? lists.filter(l => (l.heroName ?? '').toLowerCase() === heroFilter) : lists;

    // Try to authenticate — if it fails, return only published lists
    const authResult = await authenticateRequest(req, {}, { allowOAuth: true });

    if (authResult.success && !viewPublic) {
      // Check if user is curator or superadmin
      const [curatorCheck, adminCheck] = await Promise.all([
        userService.hasRole(authResult.userId!, 'isCurator'),
        userService.hasRole(authResult.userId!, 'isSuperAdmin'),
      ]);
      const isCurator = !!(curatorCheck.success && curatorCheck.data);
      const isSuperAdmin = !!(adminCheck.success && adminCheck.data);

      if (isSuperAdmin) {
        // Superadmins see all lists
        const result = await curatedListService.getAllLists();
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: filterByHero(result.data) });
      }

      if (isCurator) {
        // Curators only see lists for their assigned heroes
        const result = await curatedListService.getListsForCurator(authResult.userId!);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: filterByHero(result.data) });
      }
    }

    // Public: return published lists with cards, filtered by hero (or generic only if no hero)
    const result = await curatedListService.getPublishedListsForHero(heroFilter ?? undefined);
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

    const authResult = await authenticateRequest(req, body, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const [curatorCheck, adminCheck] = await Promise.all([
      userService.hasRole(authResult.userId!, 'isCurator'),
      userService.hasRole(authResult.userId!, 'isSuperAdmin'),
    ]);
    const isCurator = !!(curatorCheck.success && curatorCheck.data);
    const isSuperAdmin = !!(adminCheck.success && adminCheck.data);

    if (!isCurator && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Curator or Super Admin role required' }, { status: 403 });
    }

    const { name, description, heroName, className, format, tags, sortOrder, parentId, variantType } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    if (!format?.trim()) {
      return NextResponse.json({ success: false, error: 'format is required (Classic Constructed, Silver Age, Living Legend, Blitz)' }, { status: 400 });
    }

    // Non-superadmin curators can only create lists for their assigned heroes
    if (isCurator && !isSuperAdmin && heroName) {
      const assignmentsResult = await curatorHeroAssignmentService.getAssignmentsForUser(authResult.userId!);
      if (!assignmentsResult.success) {
        return NextResponse.json({ success: false, error: 'Failed to verify hero assignments' }, { status: 500 });
      }
      const assignedHeroes = assignmentsResult.data.map(a => a.heroName.toLowerCase());
      if (!assignedHeroes.includes(heroName.toLowerCase())) {
        return NextResponse.json({ success: false, error: 'You are not assigned as curator for this hero' }, { status: 403 });
      }
    }

    const result = await curatedListService.createList(authResult.userId!, {
      name,
      description,
      heroName,
      className,
      format,
      tags,
      sortOrder,
      parentId,
      variantType,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    revalidateTag('kits-summary');
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
