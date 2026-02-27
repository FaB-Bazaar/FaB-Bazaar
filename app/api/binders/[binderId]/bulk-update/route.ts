// app/api/binders/[binderId]/bulk-update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { revalidatePath } from 'next/cache';
import { binderService } from '@/lib/services';
import { Types } from 'mongoose';

/**
 * PATCH /api/binders/[binderId]/bulk-update
 *
 * Bulk update all inventory items in a binder
 * Currently supports: forTrade boolean updates
 *
 * Uses binderService.bulkUpdateCards() for the update operation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;
    const body = await request.json();

    // Authenticate request (hybrid auth: session, Discord, MCP)
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Authentication failed'
      }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Validate request body
    if (typeof body.forTrade !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid "forTrade" boolean value'
      }, { status: 400 });
    }

    // Resolve binderId if it's a slug (use service layer)
    let resolvedBinderId = binderId;
    if (!Types.ObjectId.isValid(binderId)) {
      // Try to find by slug/discordExternalId
      const binderResult = await binderService.findBinderByIdOrSlug(binderId, userId);
      if (!binderResult.success || !binderResult.data) {
        return NextResponse.json({
          success: false,
          error: 'Binder not found or access denied'
        }, { status: 404 });
      }
      resolvedBinderId = binderResult.data._id;
    }

    const startTime = Date.now();

    // Use service layer to bulk update cards
    const result = await binderService.bulkUpdateCards(
      resolvedBinderId,
      userId,
      'forTrade',
      body.forTrade
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Get updated binder info for response
    const binderResult = await binderService.getBinder(resolvedBinderId, userId);
    const binderName = binderResult.success && binderResult.data ? binderResult.data.name : 'Unknown';

    // Invalidate cache for immediate UI update
    revalidatePath(`/binder/${binderId}`);

    const totalTime = Date.now() - startTime;
    const message = `Updated ${result.data.modifiedCount} cards to ${body.forTrade ? 'FOR TRADE' : 'NOT FOR TRADE'}`;

    return NextResponse.json({
      success: true,
      message,
      modifiedCount: result.data.modifiedCount,
      matchedCount: result.data.modifiedCount,
      operation: {
        field: 'forTrade',
        newValue: body.forTrade,
        binderName,
        processingTimeMs: totalTime
      }
    });

  } catch (error) {
    console.error('[BulkUpdate] Error performing bulk update:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform bulk update'
    }, { status: 500 });
  }
}
