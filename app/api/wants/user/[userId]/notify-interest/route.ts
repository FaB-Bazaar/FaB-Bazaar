// app/api/wants/user/[userId]/notify-interest/route.ts
// Fired after a viewer copies selected cards from someone else's wants
// list — i.e. "I have some of the cards you're looking for". Posts a
// Discord channel notification tagging both users. Best-effort: webhook
// failure never fails the request (the clipboard copy already succeeded).

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';
import { DiscordWebhooks } from '@/lib/discord/discord-webhooks';
import { shouldNotifyTradeInterest } from '@/lib/discord/trade-interest-dedupe';

const MAX_CARDS = 10;
const MAX_NAME_LENGTH = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: ownerId } = await params;

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

    const ownerResult = await userService.findById(ownerId);
    if (!ownerResult.success || !ownerResult.data) {
      return NextResponse.json({ error: 'Wants list not found' }, { status: 404 });
    }
    const owner = ownerResult.data;

    // No self-pings, and at most one ping per requester+wants-list per
    // window (shared dedupe store, namespaced so a binder ping and a
    // wants ping for the same pair don't suppress each other)
    if (ownerId === requesterId || !shouldNotifyTradeInterest(requesterId, `wants:${ownerId}`)) {
      return NextResponse.json({ success: true, data: { notified: false } });
    }

    const requesterResult = await userService.findById(requesterId);
    const requester = requesterResult.success ? requesterResult.data : null;

    await DiscordWebhooks.sendWantsInterest({
      requesterUsername: requester?.username || 'A FaB Bazaar user',
      requesterDiscordId: requester?.discordId,
      ownerUsername: owner.username || 'the owner',
      ownerDiscordId: owner.discordId,
      wantsUrl: `https://fabbazaar.app/wants/${ownerId}`,
      cards,
      totalValue: Number.isFinite(Number(body.totalValue)) ? Number(body.totalValue) : undefined,
    });

    return NextResponse.json({ success: true, data: { notified: true } });
  } catch (error) {
    console.error('Error in wants notify-interest:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
