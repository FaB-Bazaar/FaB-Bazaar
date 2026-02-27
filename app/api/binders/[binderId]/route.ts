// app/api/binders/[binderId]/route.ts
// works with getting binder objects, no joins except when deleting a binder.

import { NextRequest, NextResponse } from 'next/server';
import { binderService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

// --- GET: Fetch a SINGLE binder document with its pre-calculated stats ---
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;

    // Check authentication
    const authResult = await authenticateRequest(request, {});
    const requestingUserId = authResult.success ? authResult.userId : undefined;

    // Use service layer to fetch binder (with access control)
    const result = await binderService.getBinder(binderId, requestingUserId);

    if (!result.success) {
      // Map access denied errors to 403
      if (result.error?.includes('Access denied')) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 403 });
      }
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    if (!result.data) {
      return NextResponse.json({
        success: false,
        error: 'Binder not found'
      }, { status: 404 });
    }

    const binder = result.data;
    const isOwner = authResult.success && authResult.userId === binder.userId;

    // Fetch user information for the binder owner (presentation layer)
    const ownerResult = await userService.getBasicInfo(binder.userId);
    const owner = ownerResult.success ? ownerResult.data : null;

    // Return the complete binder object with ownership info
    return NextResponse.json({
      success: true,
      binder: {
        ...binder,
        isOwner,
        // Include owner information for profile navigation
        username: owner?.username,
        discordUsername: owner?.discordUsername,
        discordId: owner?.discordId
      }
    });

  } catch (error) {
    console.error(`[API BINDER GET] Error fetching binder ${(await params).binderId}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch binder'
    }, { status: 500 });
  }
}

// --- PUT: Update a binder's settings (using atomic update) ---
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;
    const body = await request.json();

    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Build update payload from allowed fields
    const updates: any = {};
    const allowedFields = ['name', 'description', 'isPublic', 'slug', 'tags', 'archived', 'thumbnailPrintingId'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Handle visibility updates
    if (body.visibility && typeof body.visibility === 'object') {
      updates.visibility = body.visibility;
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'No fields to update.' });
    }

    // Use service layer to update binder
    const result = await binderService.updateBinder(binderId, authResult.userId!, updates);

    if (!result.success) {
      if (result.error?.includes('Access denied') || result.error?.includes('not found')) {
        return NextResponse.json({ success: false, error: result.error }, { status: 403 });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // PostgreSQL: No denormalization needed - data stays normalized, use JOINs when querying
    // MongoDB denormalization sync removed - not applicable for PostgreSQL architecture

    return NextResponse.json({
      success: true,
      binder: result.data,
      message: 'Binder updated successfully'
    });

  } catch (error: any) {
    console.error(`[API BINDER PUT] Error updating binder ${(await params).binderId}:`, error);

    if (error.code === 11000 && (error.keyPattern?.slug || error.keyPattern?.discordExternalId)) {
      return NextResponse.json({ success: false, error: `The slug is already taken.` }, { status: 409 });
    }

    return NextResponse.json({ success: false, error: 'Failed to update binder' }, { status: 500 });
  }
}

// --- DELETE: Delete a binder and all cards within it ---
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;

    // Authenticate request
    const authResult = await authenticateRequest(request, {});
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Use service layer to delete binder (cascades to InventoryItems)
    const result = await binderService.deleteBinder(binderId, authResult.userId!);

    if (!result.success) {
      if (result.error?.includes('Access denied') || result.error?.includes('not found')) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 403 });
      }
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Binder and all its cards have been deleted'
    });

  } catch (error) {
    console.error(`[API BINDER DELETE] Error deleting binder ${(await params).binderId}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete binder'
    }, { status: 500 });
  }
}

