/**
 * analyzeGame — pure derivation of display-ready insight from a raw archived
 * Talishar game blob (the shape stored in `game_result_payloads.payload`).
 *
 * No DB, no IO, no card-name lookups — just arithmetic over what Talishar sent.
 * Deliberately generic: it surfaces whatever mechanic stats are non-zero
 * (activations, passives, katsu discards, …) rather than hard-coding per-hero
 * logic, so a Katsu game or a charge deck lights up its own relevant numbers.
 *
 * `cardResults.charged` is NOT trusted — Talishar overwrites it with the katsu
 * discard count upstream (functions.inc.php). Charge/katsu come from
 * arenaCardResults, which records both correctly.
 */

// ─── Raw blob shapes (loose — we only read what we use) ──────────────────────

export interface RawCard {
  cardId?: string;
  cardName?: string;
  pitchValue?: number;
  numCopies?: number;
  played?: number;
  hits?: number;
  blocked?: number;
  pitched?: number;
  discarded?: number;
  activated?: number;
  passiveTriggered?: number;
  katsuDiscard?: number;
  [k: string]: unknown;
}

export interface RawTurn {
  damageDealt?: number;
  damageTaken?: number;
  damageBlocked?: number;
  damageThreatened?: number;
  damagePrevented?: number;
  resourcesUsed?: number;
  cardsPitched?: number;
  lifeAtTurnEnd?: number | null;
  opponentLifeAtTurnEnd?: number | null;
  [k: string]: unknown;
}

export interface RawDeckBlob {
  turns?: number;
  result?: number;
  firstPlayer?: number;
  playerHero?: string;
  opposingHero?: string;
  cardResults?: RawCard[];
  arenaCardResults?: RawCard[];
  turnResults?: Record<string, RawTurn>;
  turnLog?: [number, string, string][];
  [k: string]: unknown; // aggregate scalars (totalDamageDealt, averageValuePerTurn, …)
}

export interface RawGamePayload {
  self: RawDeckBlob;
  opponent: RawDeckBlob | null;
  format?: string | number;
  gameID?: string;
  gameGUID?: string;
  conceded?: boolean;
  [k: string]: unknown;
}

// ─── Derived (display-ready) shapes ──────────────────────────────────────────

export interface LifePoint {
  turn: number;
  you: number | null;
  opp: number | null;
}

export interface TempoRow {
  turn: number;
  dealt: number;
  taken: number;
  blocked: number;
  threatened: number;
  prevented: number;
  resourcesUsed: number;
  cardsPitched: number;
  lifeAtEnd: number | null;
  oppLifeAtEnd: number | null;
}

export interface CardStat {
  cardId: string;
  name: string;
  pitchValue: number;
  numCopies: number;
  played: number;
  hits: number;
  hitPct: number | null; // null when never played
  blocked: number;
  pitched: number;
  discarded: number;
  /** Any non-zero mechanic stat beyond the standard columns (activated, passiveTriggered, katsuDiscard). */
  extra: Record<string, number>;
}

export interface ArenaStat {
  cardId: string;
  name: string;
  blocked: number;
  activated: number;
}

export interface PlayerAnalysis {
  hero: string;
  result: 'win' | 'loss';
  firstPlayer: boolean;
  turns: number;
  totals: {
    damageDealt: number;
    damageThreatened: number;
    damageBlocked: number;
    damagePrevented: number;
    lifeGained: number;
    lifeLost: number;
    avgDamageDealtPerTurn: number;
    avgDamageThreatenedPerTurn: number;
    avgValuePerTurn: number;
    avgResourcesUsedPerTurn: number;
  };
  efficiency: { dealt: number; threatened: number; pct: number };
  perTurn: TempoRow[];
  equipment: ArenaStat[];
  engine: ArenaStat[];
  cards: CardStat[];
}

export interface ReplayAction {
  cardId: string;
  action: string; // M | P | B | D | INSTANT | A | HIT | PASSIVE | DISCARD | …
}

export interface ReplayTurn {
  turn: number;
  you: ReplayAction[]; // exact stored order — never regrouped
  opp: ReplayAction[]; // exact stored order — never regrouped
}

export interface GameAnalysis {
  meta: { gameId?: string; gameGUID?: string; format?: string; conceded: boolean };
  lifeRace: LifePoint[];
  you: PlayerAnalysis;
  opponent: PlayerAnalysis | null;
  insights: string[];
  /**
   * Turn-by-turn replay preserving EXACT stored order per player. Each player's
   * line is fully deterministic; the two are shown in parallel because Talishar
   * sends separate per-player logs with no cross-player sequence key.
   */
  replay: ReplayTurn[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);

function sortedTurns(turnResults?: Record<string, RawTurn>): Array<[number, RawTurn]> {
  if (!turnResults) return [];
  return Object.entries(turnResults)
    .map(([k, v]) => [parseInt(k.replace('turn_', ''), 10), v] as [number, RawTurn])
    .filter(([t]) => Number.isFinite(t))
    .sort((a, b) => a[0] - b[0]);
}

// Mechanic stats worth surfacing generically when non-zero. `charged` is
// intentionally excluded from cardResults (corrupted upstream); arena entries
// carry their own katsuDiscard.
const EXTRA_KEYS = ['activated', 'passiveTriggered', 'katsuDiscard'] as const;

function analyzePlayer(blob: RawDeckBlob): PlayerAnalysis {
  const turns = sortedTurns(blob.turnResults);

  const perTurn: TempoRow[] = turns.map(([turn, t]) => ({
    turn,
    dealt: num(t.damageDealt),
    taken: num(t.damageTaken),
    blocked: num(t.damageBlocked),
    threatened: num(t.damageThreatened),
    prevented: num(t.damagePrevented),
    resourcesUsed: num(t.resourcesUsed),
    cardsPitched: num(t.cardsPitched),
    lifeAtEnd: t.lifeAtTurnEnd ?? null,
    oppLifeAtEnd: t.opponentLifeAtTurnEnd ?? null,
  }));

  const cards: CardStat[] = (blob.cardResults ?? [])
    .filter((c) => typeof c.cardId === 'string')
    .map((c) => {
      const played = num(c.played);
      const extra: Record<string, number> = {};
      for (const k of EXTRA_KEYS) {
        if (num(c[k]) > 0) extra[k] = num(c[k]);
      }
      return {
        cardId: c.cardId as string,
        name: c.cardName || '',
        pitchValue: num(c.pitchValue),
        numCopies: num(c.numCopies),
        played,
        hits: num(c.hits),
        hitPct: played > 0 ? pct(num(c.hits), played) : null,
        blocked: num(c.blocked),
        pitched: num(c.pitched),
        discarded: num(c.discarded),
        extra,
      };
    });

  const arena = (blob.arenaCardResults ?? []).filter((c) => typeof c.cardId === 'string');

  const equipment: ArenaStat[] = arena
    .filter((c) => num(c.blocked) > 0)
    .map((c) => ({ cardId: c.cardId as string, name: c.cardName || '', blocked: num(c.blocked), activated: num(c.activated) }))
    .sort((a, b) => b.blocked - a.blocked);

  // Engine = anything that activated, from arena (hero/weapon) AND main deck.
  const engine: ArenaStat[] = [...arena, ...(blob.cardResults ?? [])]
    .filter((c) => typeof c.cardId === 'string' && num(c.activated) > 0)
    .map((c) => ({ cardId: c.cardId as string, name: c.cardName || '', blocked: num(c.blocked), activated: num(c.activated) }))
    .sort((a, b) => b.activated - a.activated);

  return {
    hero: (blob.playerHero as string) || '',
    result: num(blob.result) === 1 ? 'win' : 'loss',
    firstPlayer: num(blob.firstPlayer) === 1,
    turns: num(blob.turns),
    totals: {
      damageDealt: num(blob.totalDamageDealt),
      damageThreatened: num(blob.totalDamageThreatened),
      damageBlocked: num(blob.totalDamageBlocked),
      damagePrevented: num(blob.totalDamagePrevented),
      lifeGained: num(blob.totalLifeGained),
      lifeLost: num(blob.totalLifeLost),
      avgDamageDealtPerTurn: num(blob.averageDamageDealtPerTurn),
      avgDamageThreatenedPerTurn: num(blob.averageDamageThreatenedPerTurn),
      avgValuePerTurn: num(blob.averageValuePerTurn),
      avgResourcesUsedPerTurn: num(blob.averageResourcesUsedPerTurn),
    },
    efficiency: {
      dealt: num(blob.totalDamageDealt),
      threatened: num(blob.totalDamageThreatened),
      pct: pct(num(blob.totalDamageDealt), num(blob.totalDamageThreatened)),
    },
    perTurn,
    equipment,
    engine,
    cards,
  };
}

function buildReplay(
  selfLog?: [number, string, string][],
  oppLog?: [number, string, string][]
): ReplayTurn[] {
  const turns = new Set<number>();
  const collectTurns = (log?: [number, string, string][]) => {
    for (const e of log ?? []) if (Array.isArray(e) && typeof e[0] === 'number') turns.add(e[0]);
  };
  collectTurns(selfLog);
  collectTurns(oppLog);

  const entriesFor = (log: [number, string, string][] | undefined, turn: number): ReplayAction[] =>
    (log ?? [])
      .filter((e) => Array.isArray(e) && e[0] === turn && typeof e[1] === 'string')
      .map((e) => ({ cardId: e[1], action: e[2] }));

  return [...turns]
    .sort((a, b) => a - b)
    .map((turn) => ({ turn, you: entriesFor(selfLog, turn), opp: entriesFor(oppLog, turn) }));
}

function buildLifeRace(turnResults?: Record<string, RawTurn>): LifePoint[] {
  return sortedTurns(turnResults).map(([turn, t]) => ({
    turn,
    you: t.lifeAtTurnEnd ?? null,
    opp: t.opponentLifeAtTurnEnd ?? null,
  }));
}

function buildInsights(you: PlayerAnalysis): string[] {
  const out: string[] = [];
  const { efficiency: e, totals, result, firstPlayer, turns, perTurn, engine } = you;

  out.push(`Went ${firstPlayer ? 'first' : 'second'} and ${result === 'win' ? 'won' : 'lost'} in ${turns} turns.`);

  if (e.threatened > 0) {
    out.push(
      e.pct < 60
        ? `Only ${e.pct}% of threatened damage landed (${e.dealt} of ${e.threatened}) — a lot got blocked or prevented.`
        : `Converted ${e.pct}% of threatened damage (${e.dealt} of ${e.threatened}).`
    );
  }

  if (totals.damageBlocked > 0) {
    out.push(`Blocked ${totals.damageBlocked} damage across the game (avg value/turn ${totals.avgValuePerTurn}).`);
  }

  const biggest = [...perTurn].sort((a, b) => b.dealt - a.dealt)[0];
  if (biggest && biggest.dealt > 0) {
    out.push(`Biggest turn: turn ${biggest.turn} dealt ${biggest.dealt}.`);
  }

  if (engine.length > 0) {
    out.push(`Top activation: ${engine[0].name || engine[0].cardId} ×${engine[0].activated}.`);
  }

  return out;
}

export function analyzeGame(payload: RawGamePayload): GameAnalysis {
  const self = payload.self ?? ({} as RawDeckBlob);
  const you = analyzePlayer(self);
  const opponent = payload.opponent ? analyzePlayer(payload.opponent) : null;

  return {
    meta: {
      gameId: payload.gameID,
      gameGUID: payload.gameGUID,
      format: payload.format != null ? String(payload.format) : undefined,
      conceded: payload.conceded === true,
    },
    lifeRace: buildLifeRace(self.turnResults),
    you,
    opponent,
    insights: buildInsights(you),
    replay: buildReplay(self.turnLog, payload.opponent?.turnLog),
  };
}
