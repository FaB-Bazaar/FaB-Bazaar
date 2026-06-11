// app/api/user-articles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { articleService } from '@/lib/services';
import { revalidatePath } from 'next/cache';

/**
 * GET /api/user-articles
 * List current user's articles
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'draft' | 'published' | null;
    const contentType = searchParams.get('contentType') as 'article' | 'strategy' | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build filters
    const filters: any = {};
    if (status) filters.status = status;
    if (contentType) filters.contentType = contentType;

    // Build pagination
    const skip = (page - 1) * limit;

    // Get user's articles
    const result = await articleService.getUserArticles(
      authResult.userId,
      filters,
      { skip, limit, sort: { updatedAt: -1 } }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      authMethod: authResult.authMethod,
    });
  } catch (error) {
    console.error('[GET /api/user-articles] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch articles',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-articles
 * Create a new user article
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request, {});

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields (slug no longer required - deprecated as of 2026-02)
    if (!body.title) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    // contentType is optional (quick-write flow) — default to 'strategy'
    const contentType = body.contentType ?? 'strategy';

    // Validate contentType (restricted for users)
    if (!['article', 'strategy', 'hero', 'guide', 'tournament'].includes(contentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid content type. Users can only create: article, strategy, hero guide, guide, tournament' },
        { status: 400 }
      );
    }

    // Create user article (no slug - uses publicId for routing)
    const result = await articleService.createUserArticle(authResult.userId, {
      title: body.title,
      subtitle: body.subtitle,
      contentType,
      image: body.image,
      sections: body.sections || [],
      status: body.status || 'draft',
      heroClass: body.heroClass,
      heroSlug: body.heroSlug,
    });

    if (!result.success) {
      // Check if it's a rate limit error
      if (result.error?.includes('Daily article limit reached')) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 429 } // Too Many Requests
        );
      }

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Revalidate relevant pages
    revalidatePath('/my-articles');

    // If published, revalidate public pages
    if (result.data.status === 'published') {
      revalidatePath('/guides');
      revalidatePath(`/articles/${result.data.publicId}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        authMethod: authResult.authMethod,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/user-articles] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create article',
      },
      { status: 500 }
    );
  }
}
