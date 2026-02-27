// app/api/binders/[binderId]/copy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

/**
 * Generate a unique slug for the copied binder
 * Slug must match /^[a-z0-9-_]{3,20}$/
 */
async function generateUniqueSlug(userId: string, sourceSlug: string): Promise<string> {
  // Reserve space for potential counter suffix (e.g., "-999" = 4 chars)
  const maxSourceLength = 20 - 5 - 4; // 20 total - "copy-" (5) - counter space (4)
  const truncatedSource = sourceSlug.substring(0, maxSourceLength).replace(/[^a-z0-9-_]/g, '');

  let baseSlug = `copy-${truncatedSource}`;
  let slug = baseSlug;
  let counter = 1;

  // Check if slug is taken by querying service layer
  while (true) {
    const existingResult = await binderService.findBinderByIdOrSlug(slug, userId);
    if (!existingResult.success || !existingResult.data) {
      // Slug is available
      break;
    }
    // Slug taken, try next
    const counterSuffix = `-${counter}`;
    const maxBaseLength = 20 - counterSuffix.length;
    slug = `${baseSlug.substring(0, maxBaseLength)}${counterSuffix}`;
    counter++;
  }

  return slug;
}

/**
 * POST /api/binders/[binderId]/copy
 *
 * Creates a personal copy of another user's binder
 * - Creates a new private binder for the current user
 * - Copies all inventory items with forTrade=false
 * - Only accessible to authenticated users
 * - Source binder must be public or accessible to the user
 *
 * Uses binderService.copyBinder() with enforcePrivacy=true
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Authenticate the user using hybrid authentication
    const authResult = await authenticateRequest(request, body);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const userId = authResult.userId!;

    // 2. Find source binder to generate slug and get name
    const sourceResult = await binderService.getBinder(binderId);
    if (!sourceResult.success || !sourceResult.data) {
      return NextResponse.json({
        success: false,
        error: 'Source binder not found'
      }, { status: 404 });
    }

    const sourceBinder = sourceResult.data;

    // 3. Generate unique slug for the new binder
    const sourceSlug = sourceBinder.slug || sourceBinder._id.substring(0, 8);
    const newSlug = await generateUniqueSlug(userId, sourceSlug);

    // 4. Use service layer to copy binder with privacy enforcement
    const result = await binderService.copyBinder(
      binderId,
      userId,
      `Copy of ${sourceBinder.name}`,
      {
        enforcePrivacy: true,
        slug: newSlug
      }
    );

    if (!result.success) {
      // Handle specific error cases
      const status = result.error?.includes('not found') ? 404 :
                    result.error?.includes('Access denied') ? 403 :
                    result.error?.includes('private') ? 403 : 500;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    // 5. Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully copied binder to your collection`,
      newBinder: {
        id: result.data._id,
        name: result.data.name,
        slug: result.data.slug
      }
    });

  } catch (error) {
    console.error('Error copying binder:', error);

    // Handle specific MongoDB errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return NextResponse.json({
          success: false,
          error: 'Failed to create unique binder. Please try again.'
        }, { status: 409 });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to copy binder'
    }, { status: 500 });
  }
}
