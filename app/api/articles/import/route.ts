// app/api/articles/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { revalidatePath } from 'next/cache';
import { articleService } from '@/lib/services';

/**
 * POST /api/articles/import
 * Import an article from exported JSON
 *
 * Accepts clean JSON from export endpoint
 * Validates structure and creates new article
 * Author is set to current user (not preserved from export)
 *
 * Authentication: Session (admin only)
 * Authorization: isSuperAdmin || isContentCreator
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Check permissions
    // @ts-ignore
    const isSuperAdmin = session.user.roles?.isSuperAdmin;
    // @ts-ignore
    const isContentCreator = session.user.roles?.isContentCreator;

    if (!isSuperAdmin && !isContentCreator) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied. Super Admin or Content Creator role required.'
      }, { status: 403 });
    }

    const body = await req.json();

    // Validate required fields
    const { title, slug, contentType, sections } = body;

    if (!title || !slug || !contentType || !Array.isArray(sections)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid import data. Required fields: title, slug, contentType, sections (array)'
      }, { status: 400 });
    }

    // Validate contentType
    const validContentTypes = ['hero', 'article', 'guide', 'news', 'strategy'];
    if (!validContentTypes.includes(contentType)) {
      return NextResponse.json({
        success: false,
        error: `Invalid contentType. Must be one of: ${validContentTypes.join(', ')}`
      }, { status: 400 });
    }

    // Validate sections
    if (sections.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Article must have at least one section'
      }, { status: 400 });
    }

    // Import article using service layer
    const result = await articleService.importArticle(session.user.id, {
      title,
      subtitle: body.subtitle,
      slug,
      contentType,
      status: body.status || 'draft',
      image: body.image,
      sections,
      exportedAt: new Date(),
      originalAuthorId: body._metadata?.originalAuthorId,
    });

    if (!result.success) {
      // Check for slug conflict
      if (result.error?.includes('slug already exists')) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 409 });
      }
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    const newArticle = result.data;

    // Revalidate paths if published
    if (newArticle.status === 'published') {
      const path = `/${contentType === 'hero' ? 'heroes' : 'articles'}/${newArticle.slug}`;
      revalidatePath(path);
      revalidatePath('/guides');
    }

    return NextResponse.json({
      success: true,
      article: {
        _id: newArticle._id,
        title: newArticle.title,
        slug: newArticle.slug,
        contentType: newArticle.contentType,
        status: newArticle.status,
        sectionsCount: newArticle.sections.length
      },
      message: `Article "${title}" imported successfully`
    }, { status: 201 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[Import Article Error]:", error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
