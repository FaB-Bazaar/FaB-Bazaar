//app/api/binders/[binderId]/cards/[cardId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';
import type { UpdateCardDTO } from '@/lib/services/contracts/IBinderService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string; cardId: string }> }
) {
  try {
    const { binderId, cardId } = await params;

    // Get requesting user ID for access control
    const session = await auth();
    const requestingUserId = session?.user?.id;

    // Use service layer to get card
    const result = await binderService.getBinderCard(binderId, cardId, requestingUserId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    if (!result.data) {
      return NextResponse.json({ success: false, error: 'Card not found in this binder' }, { status: 404 });
    }

    // Add id field for backwards compatibility
    return NextResponse.json({ success: true, card: { ...result.data, id: result.data._id } });

  } catch (error) {
    console.error('Error fetching card details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch card details' },
      { status: 500 }
    );
  }
}

// --- PUT: Update a single inventory item OR swap printing ---
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string; cardId: string }> }
) {
  try {
    const { binderId, cardId } = await params;
    const body = await request.json();

    const authResult = await authenticateRequest(request, body, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Check if this is a printing swap action
    if (body.action === "swapPrinting") {
      const result = await binderService.swapCardPrinting(binderId, cardId, userId, body.newPrintingId);

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }

      return NextResponse.json(result.data);
    }

    // Regular card update logic
    const updates: UpdateCardDTO = {};
    if (body.quantity !== undefined) updates.quantity = body.quantity;
    if (body.condition !== undefined) updates.condition = body.condition;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.forTrade !== undefined) updates.forTrade = body.forTrade;
    if (body.forSale !== undefined) updates.forSale = body.forSale;
    if (body.language !== undefined) updates.language = body.language;

    const result = await binderService.updateBinderCard(binderId, cardId, userId, updates);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, card: result.data });

  } catch (error) {
    console.error('Error updating card:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update card' },
      { status: 500 }
    );
  }
}

// --- DELETE: Remove a single inventory item ---
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string; cardId: string }> }
) {
  try {
    const { binderId, cardId } = await params;

    const authResult = await authenticateRequest(request, {}, { allowOAuth: true });
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Use service layer to delete card
    const result = await binderService.deleteBinderCard(binderId, cardId, userId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Card removed successfully' });

  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete card' },
      { status: 500 }
    );
  }
}
