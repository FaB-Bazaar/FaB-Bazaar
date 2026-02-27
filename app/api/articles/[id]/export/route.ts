// app/api/articles/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { articleService } from '@/lib/services';

/**
 * GET /api/articles/:id/export
 * Export an article in a clean, portable JSON format
 *
 * Strips MongoDB-specific fields (_id, __v, createdAt, updatedAt)
 * Returns clean JSON ready for import into another environment
 *
 * Authentication: Session (admin only)
 * Authorization: isSuperAdmin || isContentCreator
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Export article using service layer
    const result = await articleService.exportArticle(id);

    if (!result.success) {
      const status = result.error === 'Article not found' ? 404 : 500;
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status });
    }

    const exportData = {
      ...result.data,
      // Add metadata for reference
      _metadata: {
        exportedAt: result.data.exportedAt.toISOString(),
        exportedFrom: process.env.NEXT_PUBLIC_APP_URL || 'unknown',
        originalAuthorId: result.data.originalAuthorId,
        sectionsCount: result.data.sections?.length || 0
      }
    };

    // Return as downloadable JSON file
    const filename = `${result.data.slug}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[Export Article Error]:", error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
