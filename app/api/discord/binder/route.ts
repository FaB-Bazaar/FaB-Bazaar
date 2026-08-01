import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/multi-auth";
import { binderService, userService } from "@/lib/services";

/**
 * Discord Binder API Route
 *
 * Supports two modes:
 * 1. List binders: GET ?targetDiscordId=X (no slug) - Returns list of accessible binders
 * 2. Get binder with cards: GET ?targetDiscordId=X&slug=Y - Returns binder details and cards
 *
 * Authentication: Requires Discord bot token + discordId (the requester)
 *
 * Parameters:
 * - discordId: The requester's Discord ID (used for authentication, passed via auth headers)
 * - targetDiscordId: The target user's Discord ID (whose binders to view)
 * - slug: Optional binder slug (if omitted, lists all binders)
 *
 * Access rules:
 * - Owner can see all their binders (including private)
 * - Others can only see binders with allowDiscordCommands=true
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetDiscordId = searchParams.get("targetDiscordId");
    const slug = searchParams.get("slug");

    // Authenticate request using multi-auth (Discord bot token + discordId)
    const authResult = await authenticateRequest(req, {});

    // For Discord bot access, we require authentication
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    // Only allow Discord bot to use this route
    const isDiscordBot = authResult.authMethod === 'discordId';
    if (!isDiscordBot) {
      return NextResponse.json({ success: false, error: "This endpoint is for Discord bot only" }, { status: 403 });
    }

    // Requester's userId comes from auth
    const requesterUserId = authResult.userId!;
    const requesterDiscordId = authResult.discordId;

    console.log('[Discord Binder API] Requester userId:', requesterUserId);
    console.log('[Discord Binder API] Requester discordId:', requesterDiscordId);
    console.log('[Discord Binder API] Target discordId:', targetDiscordId);

    // Determine target user
    let targetUserId: string = requesterUserId;
    let targetUser: { _id: string; username?: string; discordUsername?: string; discordId?: string } | null = null;

    if (targetDiscordId) {
      // Look up the target user by Discord ID
      const userResult = await userService.findByDiscordId(targetDiscordId);
      if (!userResult.success) {
        return NextResponse.json({ success: false, error: userResult.error || "Failed to find user" }, { status: 500 });
      }
      if (!userResult.data) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
      targetUserId = userResult.data._id;
      targetUser = userResult.data;
      console.log('[Discord Binder API] Target userId:', targetUserId);
    } else {
      // No target specified - viewing own data
      // We don't have the requester's full user data here, but we have their userId
      targetUser = null;
      console.log('[Discord Binder API] No target specified, using requester userId');
    }

    // Determine if requesting own data or someone else's
    const isOwnData = requesterUserId === targetUserId;
    console.log('[Discord Binder API] isOwnData:', isOwnData, '(requester:', requesterUserId, 'vs target:', targetUserId, ')');

    // MODE 1: List binders (no slug provided)
    if (!slug) {
      return await handleListBinders(targetUserId, targetDiscordId || '', isOwnData, targetUser);
    }

    // MODE 2: Get specific binder with cards
    return await handleGetBinder(targetUserId, slug, requesterUserId);

  } catch (error) {
    console.error("Discord binder error:", error);
    return NextResponse.json({ success: false, error: "Failed to get binder" }, { status: 500 });
  }
}

/**
 * Handle listing all accessible binders for a user
 */
async function handleListBinders(
  targetUserId: string,
  targetDiscordId: string,
  isOwnData: boolean,
  targetUser: { _id: string; username?: string; discordUsername?: string; discordId?: string } | null
) {
  // Use getUserBindersWithStats to get binders with calculated stats
  // This calculates stats on-demand using fast SQL aggregates (2-5ms per binder)
  const bindersResult = await binderService.getUserBindersWithStats(targetUserId);

  if (!bindersResult.success) {
    return NextResponse.json({ success: false, error: bindersResult.error || "Failed to list binders" }, { status: 500 });
  }

  console.log('[Discord Binder API] Found', bindersResult.data.length, 'binders for user');
  console.log('[Discord Binder API] isOwnData:', isOwnData);

  // Filter by visibility if not own binders
  // For Discord access, check the allowDiscordCommands flag
  let accessibleBinders = bindersResult.data;
  if (!isOwnData) {
    console.log('[Discord Binder API] Filtering binders for other user (not own data)');
    accessibleBinders = bindersResult.data.filter(binder => {
      // For Discord access, check allowDiscordCommands flag
      if (binder.visibility?.allowDiscordCommands === true) return true;

      // Legacy: if no visibility field, check isPublic flag
      if (!binder.visibility && binder.isPublic) return true;

      return false;
    });
    console.log('[Discord Binder API] After filtering:', accessibleBinders.length, 'accessible binders');
  } else {
    console.log('[Discord Binder API] Showing all binders (own data)');
  }

  // Use pre-calculated stats instead of fetching all cards (performance optimization)
  const bindersWithStats = accessibleBinders.map((binder) => {
    // Use stats if available, otherwise fallback to 0
    const cardCount = binder.stats?.totalQuantity || 0;
    // hideValue: the owner keeps this binder's value private — null for
    // everyone else (the bot omits the 💰 line when totalValue is null)
    const totalValue = !isOwnData && binder.hideValue
      ? null
      : Math.round(binder.stats?.totalValue?.tcg_low || binder.stats?.totalValue?.tcg_market || 0);

    return {
      _id: binder._id,
      name: binder.name,
      slug: binder.slug || binder.discordExternalId,
      cardCount,
      totalValue,
      visibility: binder.visibility,
      isPublic: binder.isPublic,
    };
  });

  return NextResponse.json({
    success: true,
    binders: bindersWithStats,
    user: targetUser ? {
      _id: targetUser._id,
      username: targetUser.username || targetUser.discordUsername,
      discordId: targetDiscordId,
    } : null,
  });
}

/**
 * Handle getting a specific binder with its cards
 */
async function handleGetBinder(
  targetUserId: string,
  slug: string,
  requestingUserId: string
) {
  // Find binder using service layer (handles slug and discordExternalId)
  const binderResult = await binderService.findBinderByIdOrSlug(slug, targetUserId);
  if (!binderResult.success) {
    return NextResponse.json({ success: false, error: binderResult.error || "Failed to find binder" }, { status: 500 });
  }

  if (!binderResult.data) {
    return NextResponse.json({ success: false, error: "Binder not found" }, { status: 404 });
  }

  const binder = binderResult.data;

  // Check visibility access for Discord
  const isOwner = requestingUserId === binder.userId;
  const isViewable =
    binder.visibility?.allowDiscordCommands === true ||
    (!binder.visibility && binder.isPublic);

  if (!isOwner && !isViewable) {
    return NextResponse.json({ success: false, error: "Access denied: Discord access not enabled for this binder" }, { status: 403 });
  }

  // Get all cards for export using service layer (uses InventoryItem)
  const exportResult = await binderService.getAllCardsForExport(binder._id);
  if (!exportResult.success) {
    return NextResponse.json({ success: false, error: exportResult.error || "Failed to get cards" }, { status: 500 });
  }

  // Return raw card data for the bot to format/paginate
  return NextResponse.json({
    success: true,
    binder: {
      _id: binder._id,
      name: binder.name,
      slug: binder.slug || binder.discordExternalId,
      cardCount: exportResult.data.totalCards,
    },
    cards: exportResult.data.cards,
  });
}
