//app/api/articles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { publicArticlePath } from '@/lib/articles/public-path';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { articleService, userService } from '@/lib/services';
import type { ArticleStatus, ArticleContentType, ArticleListFilters } from '@/lib/services/contracts/IArticleService';

/**
 * GET /api/articles
 * Query articles with optional filtering
 * Admin-only access (isSuperAdmin || isContentCreator)
 *
 * Authentication methods:
 * - Session auth (web interface)
 * - MCP token (?mcp_token=xyz)
 * - Discord bot (X-Discord-Bot-Token header + ?discordId=xyz)
 *
 * Query parameters:
 * - status: 'draft' | 'published'
 * - contentType: 'hero' | 'article' | 'guide' | 'news' | 'strategy'
 * - authorId: Filter by author ID
 * - slug: Get single article by slug
 * - limit: Number of results (default: 50, max: 100)
 * - skip: Offset for pagination (default: 0)
 * - MCP token: Authorization: Bearer <mcp_token> header
 * - discordId: Discord ID (with X-Discord-Bot-Token header)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Unified authentication (session, Discord bot, MCP token, OAuth Bearer)
    const authResult = await authenticateRequest(req, {}, { allowOAuth: true });

    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    const currentUserId = authResult.userId!;

    // Fetch full user for role checking using service layer
    const userResult = await userService.findById(currentUserId);

    if (!userResult.success || !userResult.data) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 401 });
    }

    const authenticatedUser = userResult.data;

    // Check admin permissions
    const isSuperAdmin = authenticatedUser.roles?.isSuperAdmin;
    const isContentCreator = authenticatedUser.roles?.isContentCreator;

    if (!isSuperAdmin && !isContentCreator) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied. Super Admin or Content Creator role required.'
      }, { status: 403 });
    }

    // Parse filtering query parameters
    const status = searchParams.get('status') as ArticleStatus | null;
    const contentType = searchParams.get('contentType') as ArticleContentType | null;
    const authorId = searchParams.get('authorId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    // Build filter query
    const filters: ArticleListFilters = {};

    if (status) filters.status = status;
    if (contentType) filters.contentType = contentType;
    if (authorId) filters.authorId = authorId;

    // Execute query using service layer
    const result = await articleService.listArticles(filters, { limit, skip });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data.articles,
      meta: {
        count: result.data.articles.length,
        total: result.data.total,
        limit,
        skip
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[GET Articles API Error]:", error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}

/**
 * POST /api/articles
 * Create a new article
 *
 * Authentication methods:
 * - Session auth (web interface)
 * - MCP token (?mcp_token=xyz)
 * - Discord bot (X-Discord-Bot-Token header + ?discordId=xyz)
 */
export async function POST(req: NextRequest) {
  try {
    // Parse body first for authenticateRequest (it may contain discordId)
    const body = await req.json();

    // Unified authentication (session, Discord bot, MCP token, OAuth Bearer)
    const authResult = await authenticateRequest(req, body, { allowOAuth: true });

    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required'
      }, { status: 401 });
    }

    const currentUserId = authResult.userId!;

    // Fetch full user for role checking using service layer
    const userResult = await userService.findById(currentUserId);

    if (!userResult.success || !userResult.data) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 401 });
    }

    const authenticatedUser = userResult.data;

    // Check admin permissions
    const isSuperAdmin = authenticatedUser.roles?.isSuperAdmin;
    const isContentCreator = authenticatedUser.roles?.isContentCreator;

    if (!isSuperAdmin && !isContentCreator) {
      return NextResponse.json({
        success: false,
        error: 'Permission denied. Super Admin or Content Creator role required.'
      }, { status: 403 });
    }

    const { title, slug, contentType, sections } = body;

    // Basic validation
    if (!title || !slug || !contentType || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields: title, slug, contentType, and sections are required.' }, { status: 400 });
    }

    // Create article using service layer
    const result = await articleService.createArticle(currentUserId, {
      title,
      subtitle: body.subtitle,
      slug,
      contentType,
      image: body.image,
      sections,
      status: body.status || 'draft',
    });

    if (!result.success) {
      // Check for slug conflict
      if (result.error?.includes('slug already exists')) {
        return NextResponse.json({ success: false, error: result.error }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // When content changes, we should revalidate the public paths
    revalidatePath('/guides');
    revalidatePath(publicArticlePath(result.data.publicId, contentType));

    return NextResponse.json({ success: true, article: result.data }, { status: 201 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[Create Article API Error]:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}