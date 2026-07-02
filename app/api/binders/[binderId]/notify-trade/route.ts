// app/api/binders/[binderId]/notify-trade/route.ts
// Fired after a viewer copies a trade request from someone else's binder.
// Posts a Discord channel notification tagging both users. Best-effort:
// webhook failure never fails the request (the clipboard copy already
// succeeded client-side).

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { binderService, userService } from '@/lib/services';
import { DiscordWebhooks } from '@/lib/discord/discord-webhooks';
import { shouldNotifyTradeInterest } from '@/lib/discord/trade-interest-dedupe';

const MAX_CARDS = 10;
const MAX_NAME_LENGTH = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ binderId: string }> }
) {
  try {
    const { binderId } = await params;

    const authResult = await authenticateRequest(request, {});
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }
    const requesterId = authResult.userId;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.cards)) {
      return NextResponse.json({ error: 'cards array is required' }, { status: 400 });
    }

    const cards = body.cards
      .filter((c: unknown): c is { name: string; quantity?: unknown; value?: unknown } =>
        !!c && typeof (c as any).name === 'string')
      .slice(0, MAX_CARDS)
      .map((c: { name: string; quantity?: unknown; value?: unknown }) => ({
        name: c.name.slice(0, MAX_NAME_LENGTH),
        quantity: Number.isFinite(Number(c.quantity)) ? Math.max(1, Math.floor(Number(c.quantity))) : 1,
        value: Number.isFinite(Number(c.value)) ? Number(c.value) : 0,
      }));

    // getBinder enforces visibility for the requesting user
    const binderResult = await binderService.getBinder(binderId, requesterId);
    if (!binderResult.success || !binderResult.data) {
      return NextResponse.json({ error: 'Binder not found' }, { status: 404 });
    }
    const binder = binderResult.data;

    // No self-pings, and at most one ping per requester+binder per window
    if (binder.userId === requesterId || !shouldNotifyTradeInterest(requesterId, binderId)) {
      return NextResponse.json({ success: true, data: { notified: false } });
    }

    const [ownerResult, requesterResult] = await Promise.all([
      userService.findById(binder.userId),
      userService.findById(requesterId),
    ]);
    const owner = ownerResult.success ? ownerResult.data : null;
    const requester = requesterResult.success ? requesterResult.data : null;

    await DiscordWebhooks.sendTradeInterest({
      requesterUsername: requester?.username || 'A FaB Bazaar user',
      requesterDiscordId: requester?.discordId,
      ownerUsername: owner?.username || 'the owner',
      ownerDiscordId: owner?.discordId,
      binderName: binder.name,
      binderUrl: `https://fabbazaar.app/binder/${binderId}`,
      cards,
      totalValue: Number.isFinite(Number(body.totalValue)) ? Number(body.totalValue) : undefined,
    });

    return NextResponse.json({ success: true, data: { notified: true } });
  } catch (error) {
    console.error('Error in notify-trade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
