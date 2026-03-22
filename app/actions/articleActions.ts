// app/actions/articleActions.ts
"use server";

import { articleService, userService } from '@/lib/services';
import { revalidatePath, revalidateTag } from 'next/cache';
import { auth } from "@/auth";
// IArticle import removed (MongoDB model, 2026-03-22) — fields inlined below
type ArticlePayload = {
  title?: string;
  subtitle?: string;
  slug?: string;
  content?: string;
  contentType?: string;
  image?: string;
  status?: string;
  sections?: any[];
  heroSlug?: string;
  heroClass?: string;
};

// Migrated to use articleService (2026-01-12)
export async function createArticle(payload: ArticlePayload) {
  console.log("=== CREATE ARTICLE DEBUG START ===");
  console.log("Original payload received:", JSON.stringify(payload, null, 2));
  console.log("Payload contentType specifically:", payload.contentType);

  try {
    const session = await auth();
    console.log("Auth session user ID:", session?.user?.id);

    if (!session?.user?.id) {
      console.log("Auth failed - no user ID in session");
      throw new Error("Permission denied. You must be logged in.");
    }

    // Fetch fresh user data from database to get current roles
    const userResult = await userService.getProfile(session.user.id);
    if (!userResult.success || !userResult.data) {
      console.log("Failed to fetch user from database");
      throw new Error("Permission denied. User not found.");
    }

    const { roles } = userResult.data;
    console.log("User roles from DB:", JSON.stringify(roles, null, 2));

    // Check authorization using fresh roles from database
    if (!roles.isSuperAdmin && !roles.isContentCreator) {
      console.log("Auth failed - user lacks required roles");
      throw new Error("Permission denied. You are not authorized to create articles.");
    }

    const { title, slug, contentType } = payload;
    console.log("Extracted from payload - title:", title, "slug:", slug, "contentType:", contentType);

    if (!title || !slug || !contentType) {
      console.log("Validation failed - missing required fields");
      throw new Error("Title, slug, and contentType are required.");
    }

    console.log("Using articleService to create article...");
    const articleData = {
      title,
      slug,
      contentType,
      subtitle: payload.subtitle,
      image: payload.image,
      sections: payload.sections || [],
      status: 'draft' as const,
      heroSlug: payload.heroSlug,
      heroClass: payload.heroClass,
    };
    console.log("Article data object:", JSON.stringify(articleData, null, 2));
    console.log("Article data contentType specifically:", articleData.contentType);

    console.log("Calling articleService.createArticle...");
    const result = await articleService.createArticle(session.user.id, articleData);

    if (!result.success) {
      console.log("Service returned error:", result.error);
      return { success: false, error: result.error };
    }

    console.log("Article created successfully via service!");
    console.log("Created article properties:");
    console.log("- article._id:", result.data._id);
    console.log("- article.contentType:", result.data.contentType);
    console.log("- article.title:", result.data.title);
    console.log("- article.slug:", result.data.slug);

    console.log("Triggering revalidation...");
    revalidatePath('/guides');
    console.log("Revalidation completed");

    // Return only essential data to avoid serialization issues with Mongoose documents
    const safeArticle = {
      _id: String(result.data._id),
      title: result.data.title,
      slug: result.data.slug,
      contentType: result.data.contentType,
    };

    console.log("Returning success with:", safeArticle);
    console.log("=== CREATE ARTICLE DEBUG END ===");

    return { success: true, article: safeArticle };
  } catch (error) {
    console.error("=== CREATE ARTICLE ERROR ===");
    console.error("Error type:", typeof error);
    console.error("Error message:", error instanceof Error ? error.message : "Unknown error");
    console.error("Full error object:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");

    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: message };
  }
}

// Migrated to use articleService (2026-01-12)
export async function updateArticle(articleId: string, payload: ArticlePayload) {
  console.log("=== UPDATE ARTICLE DEBUG START ===");
  console.log("Article ID:", articleId);
  console.log("Payload keys:", Object.keys(payload));
  console.log("Payload sections count:", payload.sections?.length || 0);

  // Debug: Log match-report sections specifically
  if (payload.sections) {
    payload.sections.forEach((section, idx) => {
      if (section.type === 'match-report') {
        console.log(`Section ${idx} (match-report):`, {
          round: section.round,
          hero: section.hero,
          sideboardCards: section.sideboardCards,
          sideboardCardsCount: section.sideboardCards?.length || 0
        });
      }
    });
  }

  try {
    const session = await auth();
    console.log("Session user ID:", session?.user?.id);

    if (!session?.user?.id) {
      console.log("No user ID - authentication failed");
      throw new Error("Authentication required.");
    }

    // Fetch fresh user data from database to get current roles
    const userResult = await userService.getProfile(session.user.id);
    if (!userResult.success || !userResult.data) {
      console.log("Failed to fetch user from database");
      throw new Error("Permission denied. User not found.");
    }

    const { roles } = userResult.data;
    console.log("User roles from DB:", JSON.stringify(roles, null, 2));

    // Check authorization using fresh roles from database
    if (!roles.isSuperAdmin && !roles.isContentCreator) {
      console.log("Auth failed - user lacks required roles");
      throw new Error("Permission denied. You are not authorized to update articles.");
    }

    console.log("Using articleService to update article...");
    const isSuperAdmin = roles.isSuperAdmin === true;
    console.log("Is superadmin (can skip ownership check):", isSuperAdmin);

    const result = await articleService.updateArticle(
      articleId,
      session.user.id,
      {
        title: payload.title,
        subtitle: payload.subtitle,
        slug: payload.slug,
        contentType: payload.contentType,
        image: payload.image,
        status: payload.status,
        sections: payload.sections,
        heroSlug: payload.heroSlug,
        heroClass: payload.heroClass,
      },
      { skipOwnershipCheck: isSuperAdmin }
    );

    if (!result.success) {
      console.log("Service returned error:", result.error);
      return { success: false, error: result.error };
    }

    console.log("Article updated successfully via service!");
    console.log("Result data sections count:", result.data?.sections?.length || 0);

    // Debug: Verify match-report sections were saved with sideboardCards
    if (result.data?.sections) {
      result.data.sections.forEach((section: any, idx: number) => {
        if (section.type === 'match-report') {
          console.log(`Saved section ${idx} (match-report):`, {
            round: section.round,
            hero: section.hero,
            sideboardCards: section.sideboardCards,
            sideboardCardsCount: section.sideboardCards?.length || 0
          });
        }
      });
    }

    revalidatePath('/guides');
    revalidatePath(`/${result.data.contentType === 'hero' ? 'heroes' : 'articles'}/${result.data.slug}`);

    // Invalidate Data Cache
    revalidateTag(`article-${result.data.publicId}`);
    revalidateTag('articles-published');

    console.log("=== UPDATE ARTICLE DEBUG END ===");
    // Don't return the full article - just success status to avoid serialization issues
    return { success: true };
  } catch (error) {
    console.error("=== UPDATE ARTICLE ERROR ===");
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "An unknown error";
    return { success: false, error: message };
  }
}

// Updated to use publicId instead of slug (2026-02)
export async function revalidateArticle(publicId: string, contentType: string) {
  const path = `/${contentType === 'hero' ? 'heroes' : 'articles'}/${publicId}`;

  try {
    console.log(`Attempting to revalidate: ${path}`);

    // Invalidate ISR cache (rendered pages)
    revalidatePath(path);

    // Invalidate Data Cache (article data)
    revalidateTag(`article-${publicId}`);
    revalidateTag('articles-published');

    console.log(`Successfully revalidated path and cache tags for: ${path}`);
    return { success: true };
  } catch (error) {
    console.error(`Revalidation failed for ${path}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

// Migrated to use articleService (2026-01-12)
export async function updateArticleStatus(articleId: string, newStatus: 'draft' | 'published') {
  try {
    // 1. Security check
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("Authentication required.");
    }

    // Fetch fresh user data from database to get current roles
    const userResult = await userService.getProfile(session.user.id);
    if (!userResult.success || !userResult.data) {
      throw new Error("Permission denied. User not found.");
    }

    // Check authorization - only super admins can change status
    if (!userResult.data.roles.isSuperAdmin) {
      throw new Error("Permission denied. Super Admin role required.");
    }

    const userId = session.user.id;

    // 2. Fetch article to get slug and contentType for revalidation
    const getResult = await articleService.getArticleById(articleId);
    if (!getResult.success || !getResult.data) {
      throw new Error("Article not found.");
    }

    const { slug, contentType } = getResult.data;

    // 3. Update the status via service
    const updateResult = await articleService.updateStatus(articleId, userId, newStatus);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    // 4. Trigger cache revalidation for the article's public page
    await revalidateArticle(slug, contentType);

    // 5. Revalidate the admin dashboard
    revalidatePath('/admin/articles');

    // 6. Invalidate Data Cache
    revalidateTag(`article-${slug}`);
    revalidateTag('articles-published');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: message };
  }
}


// Migrated to use articleService (2026-01-12)
export async function deleteArticle(articleId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("Authentication required.");
    }

    // Fetch fresh user data from database to get current roles
    const userResult = await userService.getProfile(session.user.id);
    if (!userResult.success || !userResult.data) {
      throw new Error("Permission denied. User not found.");
    }

    // Check authorization
    if (!userResult.data.roles.isSuperAdmin && !userResult.data.roles.isContentCreator) {
      throw new Error("Permission denied. You are not authorized to delete articles.");
    }

    // Get article for revalidation paths before deletion
    const getResult = await articleService.getArticleById(articleId);
    if (!getResult.success || !getResult.data) {
      return { success: false, error: 'Article not found.' };
    }

    const { slug, contentType } = getResult.data;

    // Delete via service (service also handles ownership check)
    const deleteResult = await articleService.deleteArticle(articleId, session.user.id);

    if (!deleteResult.success) {
      return { success: false, error: deleteResult.error };
    }

    // Revalidate the admin dashboard
    revalidatePath('/admin/articles');

    // Revalidate the public page (in case it was published)
    revalidatePath(`/${contentType === 'hero' ? 'heroes' : 'articles'}/${slug}`);
    revalidatePath('/guides');

    // Invalidate Data Cache
    revalidateTag(`article-${slug}`);
    revalidateTag('articles-published');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: message };
  }
}

// Migrated to use articleService (2026-01-12)
export async function getArticleBySlug(slug: string) {
  try {
    const session = await auth();
    // @ts-ignore
    const user = session?.user;

    if (!user?.id) {
      throw new Error("Authentication required.");
    }

    // Check if user has permission (Super Admin or Content Creator)
    // @ts-ignore
    const isSuperAdmin = user.roles?.isSuperAdmin;
    // @ts-ignore
    const isContentCreator = user.roles?.isContentCreator;

    if (!isSuperAdmin && !isContentCreator) {
      throw new Error("Permission denied. You need Super Admin or Content Creator role.");
    }

    // Use service layer
    const result = await articleService.getArticleBySlug(slug);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data) {
      return { success: false, error: 'Article not found.' };
    }

    return { success: true, article: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: message };
  }
}

// Quick toggle content type between 'hero' and 'article'
export async function updateArticleContentType(
  articleId: string,
  newContentType: 'hero' | 'article'
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Authentication required.");
    }

    // Fetch fresh user data
    const userResult = await userService.getProfile(session.user.id);
    if (!userResult.success || !userResult.data) {
      throw new Error("Permission denied. User not found.");
    }

    // Only superadmins can change content type
    if (!userResult.data.roles.isSuperAdmin) {
      throw new Error("Permission denied. Super Admin role required.");
    }

    // Get article for revalidation paths
    const getResult = await articleService.getArticleById(articleId);
    if (!getResult.success || !getResult.data) {
      return { success: false, error: 'Article not found.' };
    }

    const oldSlug = getResult.data.slug;
    const oldContentType = getResult.data.contentType;

    // Update via service
    const result = await articleService.updateArticle(
      articleId,
      session.user.id,
      { contentType: newContentType },
      { skipOwnershipCheck: true }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Revalidate pages
    revalidatePath('/admin/articles');
    revalidatePath('/guides');
    // Revalidate old and new public paths
    revalidatePath(`/${oldContentType === 'hero' ? 'heroes' : 'articles'}/${oldSlug}`);
    revalidatePath(`/${newContentType === 'hero' ? 'heroes' : 'articles'}/${oldSlug}`);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Toggle promoted status on a user article (super admins only)
export async function promoteArticle(articleId: string, promoted: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Authentication required.");
    }

    const userResult = await userService.getProfile(session.user.id);
    if (!userResult.success || !userResult.data) {
      throw new Error("Permission denied. User not found.");
    }

    if (!userResult.data.roles.isSuperAdmin) {
      throw new Error("Permission denied. Super Admin role required.");
    }

    const result = await articleService.promoteArticle(articleId, session.user.id, promoted);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/admin/articles');
    revalidatePath('/guides');
    revalidateTag('articles-published');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: message };
  }
}

// Save article content - wrapper that handles both creating and updating
// Migrated to use articleService (2026-01-12) - now just delegates to migrated functions
export async function saveArticleContent(payload: ArticlePayload & { _id?: string }) {
  try {
    const session = await auth();
    // @ts-ignore
    const user = session?.user;

    if (!user?.id) {
      throw new Error("Authentication required.");
    }

    // Check if user has permission (Super Admin or Content Creator)
    // @ts-ignore
    const isSuperAdmin = user.roles?.isSuperAdmin;
    // @ts-ignore
    const isContentCreator = user.roles?.isContentCreator;

    if (!isSuperAdmin && !isContentCreator) {
      throw new Error("Permission denied. You need Super Admin or Content Creator role.");
    }

    // If _id is provided, we're updating an existing article
    if (payload._id) {
      const result = await updateArticle(payload._id, payload);
      return result;
    } else {
      // Creating a new article
      const result = await createArticle(payload);
      return result;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: message };
  }
}