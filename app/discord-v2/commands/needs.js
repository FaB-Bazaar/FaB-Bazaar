// app/discord-v2/commands/needs.js
// "/needs" (ephemeral) + "Deck Needs" context menu (public): pick one of your
// decks, choose any-version vs specific-printings matching, get the list of
// cards you still need. Comparison math runs in deckService.getInventoryComparison;
// visibility ('eph' | 'pub') is threaded through the component custom_ids so the
// final list can differ per entry point while the pickers stay ephemeral.
import { NextResponse } from 'next/server';
import { InteractionResponseType } from 'discord-interactions';
import { userService, deckService, printingsService } from '@/lib/services';
import { createErrorResponse } from '../responses.js';
import { FOILING_MAP } from '@/lib/fab-constants';

// Pitch as a coloured square so the list scans at a glance; no-pitch cards
// (equipment, heroes) get a neutral marker.
const PITCH_SQUARES = { 1: '🟥', 2: '🟨', 3: '🟦' };
const NO_PITCH = '▫️';
const CHEAP_BELOW = 1; // per-copy price that counts as bulk
const MAX_SELECT_OPTIONS = 25; // Discord's select-menu cap

function getRequesterId(body) {
  return body.member?.user?.id || body.user?.id;
}

async function findLinkedUser(discordId) {
  const userResult = await userService.findByDiscordId(discordId);
  if (!userResult.success || !userResult.data) return null;
  return userResult.data;
}

/**
 * Entry point for both /needs (visibility 'eph') and the "Deck Needs"
 * context menu (visibility 'pub'). Always responds with an EPHEMERAL deck
 * picker; visibility only affects the final list.
 */
export async function handleNeedsCommand(body, visibility) {
  try {
    const discordId = getRequesterId(body);
    const user = await findLinkedUser(discordId);
    if (!user) {
      return createErrorResponse('User not found. Link your Discord account on fabbazaar.app first.', true);
    }

    const decksResult = await deckService.listUserDecksBasic(user._id);
    if (!decksResult.success) {
      return createErrorResponse('Failed to fetch your decks.', true);
    }
    const decks = decksResult.data;
    if (!decks.length) {
      return createErrorResponse("You don't have any decks yet. Create one at https://fabbazaar.app/decks", true);
    }

    const options = decks.slice(0, MAX_SELECT_OPTIONS).map((deck) => ({
      label: `${deck.name}`.slice(0, 100),
      value: deck.publicId,
      description: `${deck.heroDisplayName || deck.heroName || ''}${deck.format ? ` • ${deck.format}` : ''}`.slice(0, 100),
    }));

    const truncatedNote = decks.length > MAX_SELECT_OPTIONS
      ? `\n(Showing your ${MAX_SELECT_OPTIONS} most recent decks of ${decks.length}.)`
      : '';

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `**Deck needs** — which deck should I check against your collection?${truncatedNote}`,
        components: [{
          type: 1,
          components: [{
            type: 3, // string select
            custom_id: `needs_deck:${visibility}`,
            placeholder: 'Select a deck',
            min_values: 1,
            max_values: 1,
            options,
          }],
        }],
        flags: 64, // picker is always ephemeral
      },
    });
  } catch (error) {
    console.error('[Discord V2] Error in handleNeedsCommand:', error);
    return createErrorResponse(`Error listing decks: ${error.message}`, true);
  }
}

/**
 * Deck chosen → offer the matching mode.
 */
export async function handleNeedsDeckSelect(customId, body) {
  const [, visibility] = customId.split(':');
  const publicId = body.data.values[0];

  return NextResponse.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: '**Deck needs** — count any printing you own, or only the exact printings in the deck?',
      components: [{
        type: 1,
        components: [
          {
            type: 2, // button
            style: 1, // primary
            label: 'Any version',
            custom_id: `needs_mode:${visibility}:${publicId}:card`,
          },
          {
            type: 2,
            style: 2, // secondary
            label: 'Specific printings',
            custom_id: `needs_mode:${visibility}:${publicId}:printing`,
          },
        ],
      }],
    },
  });
}

const money = (n) => `$${n.toFixed(2)}`;

// "$1 and up" lines lead with the bold quantity and spell out the per-copy
// price (the line price is qty × tcgLow); "Under $1" lines stay light.
function formatNeedLine(entry, printingDetail, { light = false } = {}) {
  const qty = entry.shortage ?? entry.needed;
  const square = PITCH_SQUARES[entry.pitch] ?? NO_PITCH;
  const qtyPart = light ? `${qty}×` : `**${qty}×**`;

  let pricePart = '';
  if (entry.tcgLow) {
    pricePart = ` — ${money(qty * entry.tcgLow)}`;
    if (!light && qty > 1) pricePart += ` (${money(entry.tcgLow)} each)`;
  }
  const havePart = entry.shortage != null ? ` · you have ${entry.owned} of ${entry.needed}` : '';

  let printingPart = '';
  if (printingDetail) {
    const foiling = FOILING_MAP[printingDetail.foiling?.toLowerCase()] || printingDetail.foiling;
    const ref = printingDetail.collector_number || printingDetail.set?.toUpperCase();
    printingPart = ` · ${[ref, foiling].filter(Boolean).join(' ')}`;
  }

  return `${square} ${qtyPart} ${entry.cardName}${pricePart}${havePart}${printingPart}`;
}

/**
 * Mode chosen → run the comparison and post the needs list.
 * Visibility from the custom_id: 'eph' = only the requester sees it,
 * 'pub' = posted to the channel (embeds suppressed either way).
 */
export async function handleNeedsMode(customId, body) {
  try {
    const [, visibility, publicId, matchBy] = customId.split(':');
    const discordId = getRequesterId(body);
    const user = await findLinkedUser(discordId);
    if (!user) {
      return createErrorResponse('User not found. Link your Discord account on fabbazaar.app first.', true);
    }

    const comparisonResult = await deckService.getInventoryComparison(publicId, user._id, { matchBy });
    if (!comparisonResult.success) {
      return createErrorResponse(`Failed to compare deck: ${comparisonResult.error}`, true);
    }
    const { missing, partial, summary } = comparisonResult.data;

    // Deck name for the header (cheap lookup; comparison DTO doesn't carry it)
    const decksResult = await deckService.listUserDecksBasic(user._id);
    const deck = decksResult.success ? decksResult.data.find((d) => d.publicId === publicId) : null;
    const deckLabel = deck ? deck.name : 'your deck';
    const deckUrl = `https://fabbazaar.app/decks/${publicId}`;

    const modeLabel = matchBy === 'printing' ? 'specific printings' : 'any version';
    const flags = 4 | (visibility === 'eph' ? 64 : 0); // SUPPRESS_EMBEDS always

    const needs = [
      ...missing.map((m) => ({ ...m })),
      ...partial.map((p) => ({ ...p })),
    ];

    if (!needs.length) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `You own everything for **${deckLabel}** (${modeLabel}). Ready to sleeve up!`,
          flags,
        },
      });
    }

    // Specific-printings mode: enrich with collector number + foiling so the
    // reader knows WHICH printing is needed (comparison rows only carry names).
    let printingById = new Map();
    if (matchBy === 'printing') {
      const printingsResult = await printingsService.getPrintingsByIds(
        needs.map((n) => n.printingId),
        { limit: needs.length }
      );
      if (printingsResult.success) {
        printingById = new Map(printingsResult.data.printings.map((p) => [p.printing_id, p]));
      }
    }

    // Most expensive gaps first (mirrors coverage topMissing ordering)
    needs.sort((a, b) => ((b.tcgLow || 0) * (b.shortage ?? b.needed)) - ((a.tcgLow || 0) * (a.shortage ?? a.needed)));

    const qtyOf = (n) => n.shortage ?? n.needed;
    const priced = needs.filter((n) => n.tcgLow);
    const big = priced.filter((n) => n.tcgLow >= CHEAP_BELOW);
    const cheap = priced.filter((n) => n.tcgLow < CHEAP_BELOW);
    const unpriced = needs.filter((n) => !n.tcgLow);
    const cheapCards = cheap.reduce((sum, n) => sum + qtyOf(n), 0);
    const cheapTotal = cheap.reduce((sum, n) => sum + qtyOf(n) * n.tcgLow, 0);

    // Sections in reading order: the money first, bulk after, unpriced last.
    const blocks = [
      big.length && ['**$1 or more each**', big.map((n) => formatNeedLine(n, printingById.get(n.printingId)))],
      cheap.length && [
        `**Under $1 each** · ${cheapCards} card${cheapCards === 1 ? '' : 's'}, ${money(cheapTotal)}`,
        cheap.map((n) => formatNeedLine(n, printingById.get(n.printingId), { light: true })),
      ],
      unpriced.length && ['**No price listed**', unpriced.map((n) => formatNeedLine(n, printingById.get(n.printingId), { light: true }))],
    ].filter(Boolean);

    const header =
      `**Needs for ${deckLabel}** · ${modeLabel}\n` +
      `You own ${summary.totalOwned} of ${summary.totalNeeded} cards. Missing ${summary.totalMissing}, about ${money(summary.estimatedMissingValue)} to finish.\n`;
    const footer = `\n\n[Open ${deckLabel} on FaB Bazaar](${deckUrl})`;

    // Fit within Discord's 2000-char message cap; point at the site for the rest
    let content = header;
    let shown = 0;
    const total = blocks.reduce((sum, [, lines]) => sum + lines.length, 0);
    outer: for (const [title, lines] of blocks) {
      if (content.length + title.length + footer.length + 60 > 2000) break;
      content += `\n${title}`;
      for (const line of lines) {
        if (content.length + line.length + footer.length + 40 > 2000) break outer;
        content += `\n${line}`;
        shown++;
      }
      content += '\n';
    }
    if (shown < total) {
      content += `\n…and ${total - shown} more (full list on the site)`;
    }
    content = content.trimEnd() + footer;

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content, flags },
    });
  } catch (error) {
    console.error('[Discord V2] Error in handleNeedsMode:', error);
    return createErrorResponse(`Error building needs list: ${error.message}`, true);
  }
}
