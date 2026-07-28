// app/api/articles/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { publicArticlePath } from '@/lib/articles/public-path';
import mongoose from 'mongoose';
import { authenticateRequest as multiAuthRequest } from '@/lib/auth/multi-auth';
import { articleService, userService } from '@/lib/services';

// Helper to authenticate and check permissions for article routes
async function authenticateArticleRequest(req: NextRequest) {
  // Unified authentication (session, Discord bot, MCP token, OAuth Bearer)
  const authResult = await multiAuthRequest(req, {}, { allowOAuth: true });

  if (!authResult.success) {
    return {
      error: { success: false, error: authResult.error || 'Authentication required' },
      status: 401
    };
  }

  const currentUserId = authResult.userId!;

  // Fetch full user for role checking using service layer
  const userResult = await userService.findById(currentUserId);

  if (!userResult.success || !userResult.data) {
    return {
      error: { success: false, error: 'User not found' },
      status: 401
    };
  }

  const authenticatedUser = userResult.data;

  // Check admin permissions
  const isSuperAdmin = authenticatedUser.roles?.isSuperAdmin;
  const isContentCreator = authenticatedUser.roles?.isContentCreator;

  if (!isSuperAdmin && !isContentCreator) {
    return {
      error: { success: false, error: 'Permission denied. Super Admin or Content Creator role required.' },
      status: 403
    };
  }

  return { authenticatedUser, currentUserId, isSuperAdmin };
}

/**
 * GET /api/articles/:id
 * Fetch a single article by ID
 *
 * Authentication: Session, MCP token, or Discord bot
 * Authorization: isSuperAdmin || isContentCreator
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateArticleRequest(req);
    if ('error' in authResult) {
      return NextResponse.json(authResult.error, { status: authResult.status });
    }

    const { id } = await params;

    // Enforce publicId-only (or MongoDB ObjectId for internal admin operations)
    // Slug parameter no longer supported as of 2026-02
    const result = mongoose.Types.ObjectId.isValid(id)
      ? await articleService.getArticleById(id)
      : await articleService.getArticleByPublicId(id);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    if (!result.data) {
      return NextResponse.json({
        success: false,
        error: 'Article not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[GET Article by ID Error]:", error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}

/**
 * PATCH /api/articles/:id
 * Perform operations on an article
 *
 * Operations:
 * - append_section: Add section to end
 * - append_sections: Add multiple sections to end
 * - insert_section: Insert section at specific index
 * - update_metadata: Update title, subtitle, status, etc.
 * - delete_section: Remove section by index
 * - update_section: Update section at specific index
 *
 * Authentication: Session, MCP token, or Discord bot
 * Authorization: Article author OR isSuperAdmin
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateArticleRequest(req);
    if ('error' in authResult) {
      return NextResponse.json(authResult.error, { status: authResult.status });
    }

    const { currentUserId, isSuperAdmin } = authResult;
    const { id } = await params;

    // Get article to check ownership using service layer
    // Enforce publicId-only (or MongoDB ObjectId for internal admin operations)
    const articleResult = mongoose.Types.ObjectId.isValid(id)
      ? await articleService.getArticleById(id)
      : await articleService.getArticleByPublicId(id);

    if (!articleResult.success) {
      return NextResponse.json({
        success: false,
        error: articleResult.error
      }, { status: 500 });
    }

    if (!articleResult.data) {
      return NextResponse.json({
        success: false,
        error: 'Article not found'
      }, { status: 404 });
    }

    const article = articleResult.data;
    const articleId = article._id!;

    // Check ownership: must be author or superAdmin
    const isOwner = article.authorId === currentUserId;
    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied. You must be the article author or a Super Admin.'
      }, { status: 403 });
    }

    const body = await req.json();
    const { operation } = body;

    if (!operation) {
      return NextResponse.json({
        success: false,
        error: 'Operation type is required'
      }, { status: 400 });
    }

    let result;

    switch (operation) {
      case 'append_section': {
        const { section } = body;
        if (!section || !section.type) {
          return NextResponse.json({
            success: false,
            error: 'Section with type is required'
          }, { status: 400 });
        }

        result = await articleService.appendSection(articleId, currentUserId, section);
        break;
      }

      case 'append_sections': {
        const { sections } = body;
        if (!Array.isArray(sections) || sections.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Sections array is required'
          }, { status: 400 });
        }

        result = await articleService.appendSections(articleId, currentUserId, sections);
        break;
      }

      case 'insert_section': {
        const { section, index } = body;
        if (!section || !section.type) {
          return NextResponse.json({
            success: false,
            error: 'Section with type is required'
          }, { status: 400 });
        }

        if (typeof index !== 'number' || index < 0) {
          return NextResponse.json({
            success: false,
            error: 'Index must be a non-negative number'
          }, { status: 400 });
        }

        result = await articleService.insertSection(articleId, currentUserId, section, index);
        break;
      }

      case 'update_metadata': {
        const { updates } = body;
        if (!updates || typeof updates !== 'object') {
          return NextResponse.json({
            success: false,
            error: 'Updates object is required'
          }, { status: 400 });
        }

        // Only allow updating specific metadata fields
        const allowedFields = ['title', 'subtitle', 'status', 'image', 'contentType'];
        const updateData: any = {};

        for (const field of allowedFields) {
          if (field in updates) {
            updateData[field] = updates[field];
          }
        }

        if (Object.keys(updateData).length === 0) {
          return NextResponse.json({
            success: false,
            error: `No valid fields to update. Allowed fields: ${allowedFields.join(', ')}`
          }, { status: 400 });
        }

        result = await articleService.updateArticle(articleId, currentUserId, updateData);
        break;
      }

      case 'delete_section': {
        const { index } = body;
        if (typeof index !== 'number' || index < 0) {
          return NextResponse.json({
            success: false,
            error: 'Index must be a non-negative number'
          }, { status: 400 });
        }

        result = await articleService.deleteSection(articleId, currentUserId, index);
        break;
      }

      case 'update_section': {
        const { section, index } = body;
        if (!section || !section.type) {
          return NextResponse.json({
            success: false,
            error: 'Section with type is required'
          }, { status: 400 });
        }

        if (typeof index !== 'number' || index < 0) {
          return NextResponse.json({
            success: false,
            error: 'Index must be a non-negative number'
          }, { status: 400 });
        }

        result = await articleService.updateSection(articleId, currentUserId, section, index);
        break;
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}. Valid operations: append_section, append_sections, insert_section, update_metadata, update_section, delete_section`
        }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    const updatedArticle = result.data;

    // Revalidate the article's public page if published. Keyed by publicId —
    // the public routes resolve by publicId, so a slug-keyed path revalidates
    // a URL nothing serves and leaves the real page stale.
    if (updatedArticle.status === 'published') {
      revalidatePath(publicArticlePath(updatedArticle.publicId, updatedArticle.contentType));
      revalidatePath('/guides');
    }

    return NextResponse.json({
      success: true,
      article: updatedArticle,
      operation,
      sectionsCount: updatedArticle.sections.length
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[PATCH Article Error]:", error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
