// app/api/user-articles/[publicId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { articleService } from '@/lib/services';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * GET /api/user-articles/[publicId]
 * Get a single user article (with ownership check)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { publicId } = await params;

    // Get article by publicId
    const result = await articleService.getArticleByPublicId(publicId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    if (!result.data) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Verify it's a user article and belongs to current user
    if (!result.data.isUserArticle) {
      return NextResponse.json(
        { success: false, error: 'This is not a user article' },
        { status: 403 }
      );
    }

    if (result.data.authorId !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to access this article' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      authMethod: authResult.authMethod,
    });
  } catch (error) {
    console.error('[GET /api/user-articles/[publicId]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch article',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user-articles/[publicId]
 * Update a user article
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { publicId } = await params;
    const body = await request.json();

    // contentType is editable until publish (quick-write flow defers metadata)
    if (
      body.contentType !== undefined &&
      !['article', 'strategy', 'hero', 'guide', 'tournament'].includes(body.contentType)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid content type. Users can only set: article, strategy, hero guide, guide, tournament' },
        { status: 400 }
      );
    }

    // Get article to verify existence and get MongoDB _id
    const articleResult = await articleService.getArticleByPublicId(publicId);

    if (!articleResult.success) {
      return NextResponse.json(
        { success: false, error: articleResult.error },
        { status: 500 }
      );
    }

    if (!articleResult.data) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Update using service (includes ownership check)
    const result = await articleService.updateUserArticle(
      articleResult.data._id!,
      authResult.userId,
      {
        title: body.title,
        subtitle: body.subtitle,
        status: body.status,
        contentType: body.contentType,
        image: body.image,
        sections: body.sections,
        heroClass: body.heroClass,
        heroSlug: body.heroSlug,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('Not authorized') ? 403 : 400 }
      );
    }

    // Revalidate relevant pages
    revalidatePath('/my-articles');
    // Bust the unstable_cache data cache for this article
    revalidateTag(`article-${publicId}`);

    // If published, revalidate public pages
    if (result.data.status === 'published') {
      revalidatePath('/guides');
      revalidatePath(`/articles/${publicId}`);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      authMethod: authResult.authMethod,
    });
  } catch (error) {
    console.error('[PATCH /api/user-articles/[publicId]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update article',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user-articles/[publicId]
 * Delete a user article
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { publicId } = await params;

    // Get article to verify existence and get MongoDB _id
    const articleResult = await articleService.getArticleByPublicId(publicId);

    if (!articleResult.success) {
      return NextResponse.json(
        { success: false, error: articleResult.error },
        { status: 500 }
      );
    }

    if (!articleResult.data) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Delete using service (includes ownership check)
    const result = await articleService.deleteUserArticle(
      articleResult.data._id!,
      authResult.userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('Not authorized') ? 403 : 400 }
      );
    }

    // Revalidate list page
    revalidatePath('/my-articles');

    // If was published, revalidate public pages
    if (articleResult.data.status === 'published') {
      revalidatePath('/guides');
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      authMethod: authResult.authMethod,
    });
  } catch (error) {
    console.error('[DELETE /api/user-articles/[publicId]] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete article',
      },
      { status: 500 }
    );
  }
}
