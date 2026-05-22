// app/api/binders/[binderId]/bulk-update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { revalidatePath } from 'next/cache';
import { binderService } from '@/lib/services';
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

    const startTime = Date.now();

    // Use service layer to bulk update cards (ID only — slug lookup is for Discord/MCP)
    const result = await binderService.bulkUpdateCards(
      binderId,
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
    const binderResult = await binderService.getBinder(binderId, userId);
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
