// app/api/binders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { binderService, userService } from '@/lib/services';
import { authenticateRequest, verifyDiscordBotToken } from '@/lib/auth/multi-auth';
import mongoose from 'mongoose';

/**
 * GET /api/binders
 * 
 * Returns binders based on query parameters:
 * - No params: Returns current user's own binders
 * - ?userId=xyz: Returns public binders for specified user
 * - ?summary=true: Returns minimal data (name, slug, _id only)
 * - ?mcp_token=xyz: Authenticates with MCP token and returns only mcp-binder
 * 
 * Authentication methods supported:
 * - Session auth (web interface)
 * - Discord bot token (X-Discord-Bot-Token header + discordId param)
 * - MCP token (mcp_token query parameter)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId'); // For public binders
    const isSummary = searchParams.get('summary') === 'true';
    const mcpToken = searchParams.get('mcp_token'); // For filtering mcp-binder

    console.log('[API TRACK] /api/binders called', {
      time: new Date().toISOString(),
      summary: isSummary,
      userId: requestedUserId ? 'provided' : 'own'
    });

    let currentUserId: string | null = null;
    let authMethod: string | undefined;

    // Use shared multi-auth helper for authentication
    const authResult = await authenticateRequest(req, {}, { allowOAuth: true });

    if (authResult.success) {
      currentUserId = authResult.userId!;
      authMethod = authResult.authMethod;
    } else if (requestedUserId) {
      // Public access - no authentication required for viewing public binders
      currentUserId = null;
    } else {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    let targetUserId: string;
    let isPublicAccess = false;

    if (requestedUserId) {
      // Case 2, 4, 6: Public binders of another user
      targetUserId = requestedUserId;
      isPublicAccess = true;
    } else if (currentUserId) {
      // Case 1, 3, 5: My own binders
      targetUserId = currentUserId;
      isPublicAccess = false;
    } else {
      return NextResponse.json({
        success: false,
        error: 'User ID required'
      }, { status: 400 });
    }

    // For summary requests on own binders, use getUserBindersWithStats for card counts
    if (isSummary && !isPublicAccess && currentUserId) {
      const statsResult = await binderService.getUserBindersWithStats(targetUserId);
      if (!statsResult.success) {
        return NextResponse.json({ success: false, error: statsResult.error }, { status: 500 });
      }

      let bindersWithStats = statsResult.data;

      if (authMethod === 'mcpToken' || mcpToken) {
        bindersWithStats = bindersWithStats.filter(b => b.slug === 'mcp-binder');
      }

      return NextResponse.json(
        {
          success: true,
          binders: bindersWithStats,
          meta: { isPublicAccess, targetUserId, requestedBy: currentUserId }
        },
        { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } }
      );
    }

    // Use service layer to fetch binders
    const result = await binderService.listBinders(
      {
        userId: targetUserId,
        archived: false,
      },
      {
        sort: { updatedAt: -1 },
      }
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    let binders = result.data;

    // Filter by visibility.level for public access
    // visibility.level is the source of truth: 'public' and 'unlisted' are viewable
    // Fallback to isPublic for legacy data without visibility.level
    if (isPublicAccess) {
      binders = binders.filter((b) => {
        const level = b.visibility?.level;
        if (level === 'public' || level === 'unlisted') return true;
        if (level === undefined) return b.isPublic === true;
        return false;
      });
    }

    // Filter by slug if authenticated via MCP token (NOTE: Could move this to service layer later)
    if (authMethod === 'mcpToken' || mcpToken) {
      binders = binders.filter(b => b.slug === 'mcp-binder');
    }

    // For summary requests, return cached response
    if (isSummary) {
      return NextResponse.json(
        {
          success: true,
          binders,
          meta: {
            isPublicAccess,
            targetUserId,
            requestedBy: currentUserId
          }
        },
        {
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
          }
        }
      );
    }

    // Add card count (requires reading from Binder model directly for now)
    // This will be refactored in Phase 2B when we implement card management
    const Binder = (await import('@/models/Binder')).default;
    const binderIds = binders.map(b => new mongoose.Types.ObjectId(b._id));
    const fullBinders = await Binder.find({ _id: { $in: binderIds } }).lean();

    binders = binders.map(binder => {
      const fullBinder = fullBinders.find(fb => fb._id.toString() === binder._id);
      return {
        ...binder,
        cardCount: Array.isArray(fullBinder?.cards) ? fullBinder.cards.length : 0,
        cards: Array.isArray(fullBinder?.cards)
          ? fullBinder.cards.map((card: any) => ({
              ...card,
              _id: card._id?.toString?.() || card._id,
            }))
          : [],
      };
    });

    return NextResponse.json({
      success: true,
      binders,
      meta: {
        isPublicAccess,
        targetUserId,
        requestedBy: currentUserId
      }
    });

  } catch (error) {
    console.error('Error fetching binders:', error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}

/**
 * POST /api/binders
 *
 * Creates a new binder for the authenticated user
 * Only supports session authentication (web interface)
 */
export async function POST(req: NextRequest) {
  try {
    // Only allow session auth for creating binders
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({
        error: "Authentication required"
      }, { status: 401 });
    }

    const {
      name,
      slug,
      tags,
      description,
      visibility
    } = await req.json();

    if (!name || !slug) {
      return NextResponse.json({
        error: "Name and slug are required"
      }, { status: 400 });
    }

    // Get user details for Discord integration using service layer
    const userResult = await userService.findById(session.user.id);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({
        error: "User not found"
      }, { status: 404 });
    }

    const userDoc = userResult.data;

    // Determine isPublic based on visibility level
    const isPublic = visibility ?
      (visibility.level === 'public' || visibility.level === 'unlisted') :
      true;

    // Use service layer to create binder with all fields
    const result = await binderService.createBinder(session.user.id, {
      name,
      description,
      isPublic,
      slug,
      discordUsername: userDoc.discordUsername,
      discordId: userDoc.discordId || null,
      tags: tags || [],
      visibility: visibility || {
        level: 'public',
        allowInSearch: true,
        allowInMatching: true,
        allowDiscordCommands: true,
        allowApiExport: true,
        allowWhoHas: true,
        allowWebhooks: true,
      },
    });

    if (!result.success) {
      // Return 409 for mcp-binder duplicate, 500 for other errors
      const status = result.error?.includes('MCP binder') ? 409 : 500;
      return NextResponse.json({
        error: result.error
      }, { status });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      binder: result.data, // backward compat for direct fetch callers
    });

  } catch (error: any) {
    console.error('Error creating binder:', error);

    // Handle unique constraint violations
    if (error.code === 11000 && error.keyPattern?.slug) {
      return NextResponse.json({
        error: `The slug '${error.keyValue.slug}' is already taken. Please choose a unique one.`
      }, { status: 409 });
    }

    return NextResponse.json({
      error: 'Failed to create binder',
      details: error.message
    }, { status: 500 });
  }
}