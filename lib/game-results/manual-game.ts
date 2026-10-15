// lib/game-results/manual-game.ts — validation for a game logged by hand
// (games played outside Talishar, or migrated from Fabrary). Produces the same
// column shapes the Talishar sync writes, so manual games read like synced ones:
// heroes as Talishar ids (`malice_domina_of_the_dead`), the format as a Talishar
// format code ('0' cc, '1' compcc … — lib/talishar/canonicalHero.ts). Turn-by-
// turn data is never part of a manual game.

import { HERO_NICKNAMES, TALISHAR_HERO_SLUGS } from '@/lib/fab-constants/heroes';

/** "Jarl Vetreiði" → "jarl_vetreidi" — the shape Talishar ids take. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** A hero name, nickname or Talishar id → the Talishar id; null when unknown. */
export function resolveTalisharHeroId(input: string): string | null {
  const lower = (input ?? '').trim().toLowerCase();
  if (!lower) return null;
  if (TALISHAR_HERO_SLUGS[lower]) return TALISHAR_HERO_SLUGS[lower];
  const nick = HERO_NICKNAMES[lower as keyof typeof HERO_NICKNAMES];
  if (nick && TALISHAR_HERO_SLUGS[nick.toLowerCase()]) return TALISHAR_HERO_SLUGS[nick.toLowerCase()];
  const slug = slugify(lower);
  return Object.values(TALISHAR_HERO_SLUGS).includes(slug) ? slug : null;
}

// Event-type labels (Talishar / Fabrary wording) and short codes → format code.
const EVENT_TYPES: Record<string, string> = {
  cc: '0', classic_constructed: '0',
  compcc: '1', classic_constructed_competitive: '1', competitive_classic_constructed: '1',
  blitz: '2',
  compblitz: '3', blitz_competitive: '3', competitive_blitz: '3',
  commoner: '5',
  llcc: '8', living_legend: '8', living_legend_classic_constructed: '8',
  compllcc: '13', living_legend_competitive: '13',
  sage: '14', silver_age: '14',
  compsage: '15', silver_age_competitive: '15', competitive_silver_age: '15',
  open: '17', open_format: '17',
};
const KNOWN_CODES = new Set(Object.values(EVENT_TYPES));

/** "Classic Constructed Competitive" / "compcc" / "1" → '1'; null when unknown. */
export function parseEventType(input: string): string | null {
  const s = slugify(String(input ?? ''));
  if (KNOWN_CODES.has(s)) return s;
  return EVENT_TYPES[s] ?? null;
}

/** The casual format code for a deck's format, used when a game names none. */
export function deckFormatToCode(deckFormat: string | null | undefined): string | null {
  if (!deckFormat) return null;
  return parseEventType(deckFormat);
}

export interface ManualGameInput {
  opponentHero?: unknown;
  result?: unknown;
  playedAt?: unknown;
  eventType?: unknown;
  turnOrder?: unknown;
  firstPlayer?: unknown;
  totalTurns?: unknown;
}

export interface ManualGame {
  opponentHero: string;
  playedAt: Date;
  format: string | null;
  firstPlayer: boolean | null;
  totalTurns: number | null;
  result: 'win' | 'loss';
}

const WIN = new Set(['win', 'won', 'w']);
const LOSS = new Set(['loss', 'lost', 'lose', 'l']);
// A little slack for clock skew between the caller and the server.
const FUTURE_SLACK_MS = 10 * 60 * 1000;

export function parseManualGame(
  raw: ManualGameInput,
  ctx: { defaultFormat: string | null; now?: Date },
): { ok: true; value: ManualGame } | { ok: false; error: string } {
  const heroIn = typeof raw.opponentHero === 'string' ? raw.opponentHero : '';
  const opponentHero = resolveTalisharHeroId(heroIn);
  if (!opponentHero) return { ok: false, error: `Unknown opponentHero "${heroIn}" — use the hero's full name, e.g. "Dorinthea Ironsong".` };

  const resultIn = String(raw.result ?? '').trim().toLowerCase();
  const result = WIN.has(resultIn) ? 'win' : LOSS.has(resultIn) ? 'loss' : null;
  if (!result) return { ok: false, error: `result must be "win" or "loss" (got "${raw.result ?? ''}").` };

  const playedAt = typeof raw.playedAt === 'string' || raw.playedAt instanceof Date ? new Date(raw.playedAt) : new Date(NaN);
  if (Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: 'playedAt must be a date-time with its timezone, e.g. "2026-10-14T20:49:00-04:00".' };
  }
  if (playedAt.getTime() > (ctx.now ?? new Date()).getTime() + FUTURE_SLACK_MS) {
    return { ok: false, error: 'playedAt is in the future.' };
  }

  let format = ctx.defaultFormat;
  if (raw.eventType != null && raw.eventType !== '') {
    format = parseEventType(String(raw.eventType));
    if (!format) return { ok: false, error: `Unknown eventType "${raw.eventType}" — e.g. "Classic Constructed" or "Classic Constructed Competitive".` };
  }

  let firstPlayer: boolean | null = null;
  if (typeof raw.firstPlayer === 'boolean') firstPlayer = raw.firstPlayer;
  else if (raw.turnOrder != null && raw.turnOrder !== '') {
    const t = String(raw.turnOrder).trim().toLowerCase();
    if (t === 'first' || t === '1st') firstPlayer = true;
    else if (t === 'second' || t === '2nd') firstPlayer = false;
    else return { ok: false, error: `turnOrder must be "first" or "second" (got "${raw.turnOrder}").` };
  }

  let totalTurns: number | null = null;
  if (raw.totalTurns != null && raw.totalTurns !== '') {
    const n = Number(raw.totalTurns);
    if (!Number.isInteger(n) || n < 0 || n > 200) return { ok: false, error: 'totalTurns must be a whole number from 0 to 200.' };
    totalTurns = n;
  }

  return { ok: true, value: { opponentHero, playedAt, format, firstPlayer, totalTurns, result } };
}
