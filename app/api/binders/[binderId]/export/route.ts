// app/api/binders/[binderId]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService } from '@/lib/services';
import { formatCardList } from '@/lib/formatters/cardListFormatter';
import type { InventoryCardDTO } from '@/lib/services/contracts/IBinderService';

function sortCards(cards: InventoryCardDTO[], sortBy: string) {
  const sortedCards = [...cards]; // Don't mutate original array

  switch (sortBy) {
    case 'name':
      return sortedCards.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
    case 'quantity-desc':
      return sortedCards.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
    case 'quantity-asc':
      return sortedCards.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
    case 'tcg-market-desc':
      return sortedCards.sort((a, b) => (b.tcg_market || 0) - (a.tcg_market || 0));
    case 'tcg-market-asc':
      return sortedCards.sort((a, b) => (a.tcg_market || 0) - (b.tcg_market || 0));
    case 'tcg-low-desc':
      return sortedCards.sort((a, b) => (b.tcg_low || 0) - (a.tcg_low || 0));
    case 'tcg-low-asc':
      return sortedCards.sort((a, b) => (a.tcg_low || 0) - (b.tcg_low || 0));
    default: // 'default' or addedAt
      return sortedCards.sort((a, b) => {
        const dateA = new Date(a.addedAt || 0).getTime();
        const dateB = new Date(b.addedAt || 0).getTime();
        return dateB - dateA; // Newest first
      });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;
    const url = new URL(request.url);

    // Parse format options from query params
    const format = url.searchParams.get('format') || 'discord';
    const includePrice = url.searchParams.get('includePrice') !== 'false';
    const priceField = url.searchParams.get('priceField') || 'tcg_low';
    const includeCondition = url.searchParams.get('includeCondition') === 'true';
    const includeNotes = url.searchParams.get('includeNotes') === 'true';
    const sortBy = url.searchParams.get('sortBy') || 'name';

    // Find binder using service layer
    const binderResult = await binderService.findBinderByIdOrSlug(binderId);
    if (!binderResult.success) {
      return NextResponse.json({
        success: false,
        error: binderResult.error || 'Failed to find binder'
      }, { status: 500 });
    }

    if (!binderResult.data) {
      return NextResponse.json({
        success: false,
        error: 'Binder not found'
      }, { status: 404 });
    }

    const binder = binderResult.data;

    // Check access permissions using multi-auth
    const authResult = await authenticateRequest(request, {});
    const isOwner = authResult.success && authResult.userId === binder.userId;

    // Check visibility access (same logic as cards route)
    const level = binder.visibility?.level;
    const isViewable =
      level === 'public' ||
      level === 'unlisted' ||
      (level === undefined && binder.isPublic);

    if (!isOwner && !isViewable) {
      return NextResponse.json({
        success: false,
        error: 'Access denied: This binder is private'
      }, { status: 403 });
    }

    // Get ALL cards for export using service layer
    const exportResult = await binderService.getAllCardsForExport(binder._id);
    if (!exportResult.success) {
      return NextResponse.json({
        success: false,
        error: exportResult.error || 'Failed to get cards'
      }, { status: 500 });
    }

    // Sort cards
    const sortedCards = sortCards(exportResult.data.cards, sortBy);

    // Format the cards
    const formattedList = formatCardList(sortedCards, {
      format: format as any,
      includePrice,
      priceField: priceField as any,
      includeCondition,
      includeNotes
    });

    // Return appropriate content type
    const contentType = format === 'json' ? 'application/json' : 'text/plain';
    const fileExtension = format === 'json' ? 'json' : (format === 'csv' ? 'csv' : 'txt');

    return new NextResponse(formattedList, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${binder.name}-cards.${fileExtension}"`
      }
    });

  } catch (error) {
    console.error('Error exporting binder cards:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to export cards'
    }, { status: 500 });
  }
}
