import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { binderService } from "@/lib/services"
import type { CreateBinderDTO, UpdateBinderDTO } from "@/lib/services/contracts/IBinderService"

// GET: List user's binders
export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const session = await auth();
    const isOwnBinders = session?.user?.id === userId;

    const { searchParams } = new URL(req.url)
    const publicOnly = searchParams.get("public") === "true"

    // Only allow seeing private binders if authenticated and viewing own binders
    // Otherwise, always filter to public only
    const shouldFilterPublic = !isOwnBinders || publicOnly;

    // Use service layer to list binders
    const result = await binderService.listBinders({
      userId,
      isPublic: shouldFilterPublic ? true : undefined,
      archived: false
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to fetch binders" }, { status: 500 })
    }

    // Format response to match existing API contract
    const plainBinders = result.data.map(binder => ({
      ...binder,
      cardCount: 0, // Service doesn't return card count, would need cards array
    }));

    return NextResponse.json({ binders: plainBinders })
  } catch (error) {
    console.error("Error fetching binders:", error);
    return NextResponse.json({ error: "Failed to fetch binders" }, { status: 500 })
  }
}

// POST: Create a new binder
export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const session = await auth();
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      name,
      tags,
      slug,
      visibility,
      description
    } = await req.json()

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required fields" }, { status: 400 })
    }

    // Check for existing MCP binder
    if (slug === 'mcp-binder') {
      const existingBinders = await binderService.listBinders({
        userId: session.user.id,
        archived: false
      });

      if (existingBinders.success) {
        const hasMcpBinder = existingBinders.data.some(b => b.slug === 'mcp-binder');
        if (hasMcpBinder) {
          return NextResponse.json({ error: "You already have an MCP binder." }, { status: 409 });
        }
      }
    }

    // Build create DTO
    const createData: CreateBinderDTO = {
      name,
      slug,
      description,
      tags: tags || [],
      visibility: visibility || {
        level: 'public',
        allowInSearch: true,
        allowInMatching: true,
        allowDiscordCommands: true,
        allowApiExport: true,
        allowWhoHas: true,
        allowWebhooks: true,
      },
      isPublic: visibility ? (visibility.level === 'public' || visibility.level === 'unlisted') : true,
    };

    // Use service layer to create binder
    const result = await binderService.createBinder(session.user.id, createData);

    if (!result.success) {
      // Check for slug conflict
      if (result.error?.includes('slug') || result.error?.includes('duplicate')) {
        return NextResponse.json({ error: `The slug '${slug}' is already taken. Please choose a unique one.` }, { status: 409 });
      }
      return NextResponse.json({ error: result.error || 'Failed to create binder' }, { status: 500 });
    }

    return NextResponse.json({ binder: result.data });

  } catch (error: any) {
    console.error('Error creating binder:', error);
    if (error.code === 11000 && error.keyPattern?.slug) {
      return NextResponse.json({ error: `The slug '${error.keyValue.slug}' is already taken. Please choose a unique one.` }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create binder', details: error.message }, { status: 500 });
  }
}

// PATCH: Update a binder
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    const { userId } = await params
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      binderId,
      name,
      description,
      isPublic,
      tags,
      archived,
      slug,
      isOnHand,
      visibility
    } = await req.json()

    if (!binderId) {
      return NextResponse.json({ error: "binderId required" }, { status: 400 })
    }

    // Check if binder exists and user owns it
    const existingBinder = await binderService.getBinder(binderId, session.user.id);
    if (!existingBinder.success || !existingBinder.data) {
      return NextResponse.json({ error: "Binder not found" }, { status: 404 })
    }

    // Prevent renaming to/from mcp-binder
    if (slug === 'mcp-binder' && existingBinder.data.slug !== 'mcp-binder') {
      return NextResponse.json({ error: "Cannot rename binder to 'mcp-binder'." }, { status: 403 });
    }
    if (existingBinder.data.slug === 'mcp-binder' && (slug !== undefined && slug !== 'mcp-binder')) {
      return NextResponse.json({ error: "Cannot change MCP binder slug." }, { status: 403 });
    }

    // Build update DTO with only provided fields
    const updateData: UpdateBinderDTO = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (tags !== undefined) updateData.tags = tags;
    if (archived !== undefined) updateData.archived = archived;
    if (slug !== undefined) updateData.slug = slug;
    if (visibility !== undefined) updateData.visibility = visibility;

    // Use service layer to update binder
    const result = await binderService.updateBinder(binderId, session.user.id, updateData);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to update binder" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      binder: result.data
    })
  } catch (error) {
    console.error("Error updating binder:", error);
    return NextResponse.json({ error: "Failed to update binder" }, { status: 500 })
  }
}

// DELETE: Delete a binder
export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    const { userId } = await params;
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const binderId = searchParams.get("binderId");
    if (!binderId) {
      return NextResponse.json({ error: "binderId required" }, { status: 400 });
    }

    // Check if binder exists and user owns it
    const existingBinder = await binderService.getBinder(binderId, session.user.id);
    if (!existingBinder.success || !existingBinder.data) {
      return NextResponse.json({ error: "Binder not found" }, { status: 404 });
    }

    // Prevent deleting MCP binder
    if (existingBinder.data.slug === 'mcp-binder') {
      return NextResponse.json({ error: "MCP binders cannot be deleted." }, { status: 403 });
    }

    // Use service layer to delete binder
    const result = await binderService.deleteBinder(binderId, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to delete binder" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting binder:", err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: "Failed to delete binder", details: errorMessage }, { status: 500 });
  }
}
