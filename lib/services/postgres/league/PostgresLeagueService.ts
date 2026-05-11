/**
 * PostgreSQL implementation of ILeagueService.
 *
 * Ownership enforcement lives here (caller passes `actingUserId`; the
 * service verifies the league owner matches before mutating). Curator
 * gating for league *creation* lives at the API layer, mirroring how
 * curated lists work — the service trusts that the route already
 * checked the role.
 *
 * Visibility: read methods accept an optional `viewerUserId` so the
 * owner sees private content they own, while everyone else gets the
 * public-only view.
 */

import { db } from '@/lib/postgres/db';
import {
  leagues,
  leagueEvents,
  leagueEventDecks,
  decks,
} from '@/lib/postgres/schema';
import { and, eq, desc, asc, inArray, sql, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import type {
  ILeagueService,
  LeagueDTO,
  LeagueEventDTO,
  LeagueEventDeckDTO,
  LeagueWithNextEventDTO,
  CreateLeagueDTO,
  UpdateLeagueDTO,
  CreateLeagueEventDTO,
  UpdateLeagueEventDTO,
  AddEventResultDTO,
  UpdateEventResultDTO,
  ListLeaguesOptions,
  ListLeaguesWithNextEventOptions,
  ListEventsOptions,
  LeagueEventStatus,
} from '../../contracts/ILeagueService';
import type { AsyncResult } from '../../contracts/common';

// ---------------------------------------------------------------------------
// Row → DTO mappers
// ---------------------------------------------------------------------------

type LeagueRow = typeof leagues.$inferSelect;
type LeagueEventRow = typeof leagueEvents.$inferSelect;
type LeagueEventDeckRow = typeof leagueEventDecks.$inferSelect;

function toLeagueDTO(row: LeagueRow): LeagueDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    format: row.format,
    bannerUrl: row.bannerUrl,
    discordGuildId: row.discordGuildId,
    discordInviteUrl: row.discordInviteUrl,
    ownerId: row.ownerId,
    public: row.public,
    scheduleSummary: row.scheduleSummary,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEventDTO(row: LeagueEventRow): LeagueEventDTO {
  return {
    id: row.id,
    leagueId: row.leagueId,
    name: row.name,
    description: row.description,
    scheduledFor: row.scheduledFor,
    status: row.status as LeagueEventStatus,
    format: row.format,
    public: row.public,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toResultDTO(row: LeagueEventDeckRow): LeagueEventDeckDTO {
  return {
    id: row.id,
    eventId: row.eventId,
    deckId: row.deckId,
    userId: row.userId,
    playerHandle: row.playerHandle,
    heroName: row.heroName,
    placing: row.placing,
    matchRecord: row.matchRecord,
    droppedRound: row.droppedRound,
    byes: row.byes,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

// Events currently surfaced on the public directory. Single source of truth so
// the API route and the service stay in sync.
export const ACTIVE_EVENT_STATUSES: LeagueEventStatus[] = ['upcoming', 'in_progress'];

function err(message: string, code?: string): { success: false; error: string; code?: string } {
  return code ? { success: false, error: message, code } : { success: false, error: message };
}

function ok<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

function normalizeDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type Failure = { success: false; error: string; code?: string };
type GateResult<T> = { ok: true; data: T } | { ok: false; failure: Failure };

export class PostgresLeagueService implements ILeagueService {
  // ====================================================================
  // Private gates
  // --------------------------------------------------------------------
  // Each gate runs in one round-trip and returns either the row(s) the
  // caller needs or a ready-to-surface Failure. Centralizing them keeps
  // the privacy / ownership invariants in a single auditable place.
  // ====================================================================

  /** Fetch a league by an arbitrary predicate, applying visibility filtering. */
  private async findVisibleLeague(
    predicate: ReturnType<typeof eq>,
    viewerUserId?: string,
  ): Promise<GateResult<LeagueRow>> {
    const [row] = await db.select().from(leagues).where(predicate).limit(1);
    if (!row) return { ok: false, failure: err('league not found', 'not_found') };
    if (!row.public && row.ownerId !== viewerUserId) {
      // Don't reveal existence of private leagues to non-owners.
      return { ok: false, failure: err('league not found', 'not_found') };
    }
    return { ok: true, data: row };
  }

  /** Require the acting user to own the named league. */
  private async requireLeagueOwner(
    leagueId: string,
    actingUserId: string,
  ): Promise<GateResult<LeagueRow>> {
    const [row] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!row) return { ok: false, failure: err('league not found', 'not_found') };
    if (row.ownerId !== actingUserId) return { ok: false, failure: err('forbidden', 'forbidden') };
    return { ok: true, data: row };
  }

  /** Require the acting user to own the league this event belongs to. One JOIN, one round-trip. */
  private async requireEventForOwner(
    eventId: string,
    actingUserId: string,
  ): Promise<GateResult<LeagueEventRow>> {
    const [row] = await db
      .select({ event: leagueEvents, leagueOwnerId: leagues.ownerId })
      .from(leagueEvents)
      .innerJoin(leagues, eq(leagues.id, leagueEvents.leagueId))
      .where(eq(leagueEvents.id, eventId))
      .limit(1);
    if (!row) return { ok: false, failure: err('event not found', 'not_found') };
    if (row.leagueOwnerId !== actingUserId) return { ok: false, failure: err('forbidden', 'forbidden') };
    return { ok: true, data: row.event };
  }

  /** Require the acting user to own the league this result belongs to. Two JOINs, one round-trip. */
  private async requireResultForOwner(
    resultId: string,
    actingUserId: string,
  ): Promise<GateResult<LeagueEventDeckRow>> {
    const [row] = await db
      .select({ result: leagueEventDecks, leagueOwnerId: leagues.ownerId })
      .from(leagueEventDecks)
      .innerJoin(leagueEvents, eq(leagueEvents.id, leagueEventDecks.eventId))
      .innerJoin(leagues, eq(leagues.id, leagueEvents.leagueId))
      .where(eq(leagueEventDecks.id, resultId))
      .limit(1);
    if (!row) return { ok: false, failure: err('result not found', 'not_found') };
    if (row.leagueOwnerId !== actingUserId) return { ok: false, failure: err('forbidden', 'forbidden') };
    return { ok: true, data: row.result };
  }

  /** Load an event applying combined league+event privacy in a single JOIN. */
  private async loadVisibleEvent(
    eventId: string,
    viewerUserId?: string,
  ): Promise<GateResult<LeagueEventRow>> {
    const [row] = await db
      .select({
        event: leagueEvents,
        leaguePublic: leagues.public,
        leagueOwnerId: leagues.ownerId,
      })
      .from(leagueEvents)
      .innerJoin(leagues, eq(leagues.id, leagueEvents.leagueId))
      .where(eq(leagueEvents.id, eventId))
      .limit(1);
    if (!row) return { ok: false, failure: err('event not found', 'not_found') };
    const isOwner = row.leagueOwnerId === viewerUserId;
    if ((!row.event.public || !row.leaguePublic) && !isOwner) {
      return { ok: false, failure: err('event not found', 'not_found') };
    }
    return { ok: true, data: row.event };
  }

  // ====================================================================
  // Leagues
  // ====================================================================

  async createLeague(ownerId: string, dto: CreateLeagueDTO): AsyncResult<LeagueDTO> {
    if (!ownerId) return err('ownerId is required');
    if (!dto.name?.trim()) return err('name is required');
    if (!dto.slug?.trim()) return err('slug is required');
    if (!SLUG_PATTERN.test(dto.slug)) {
      return err('slug must be lowercase alphanumeric with hyphens (3-64 chars)');
    }

    const existing = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.slug, dto.slug))
      .limit(1);
    if (existing.length > 0) return err('slug is already taken', 'slug_taken');

    const id = nanoid();
    const now = new Date();
    const row: typeof leagues.$inferInsert = {
      id,
      slug: dto.slug,
      name: dto.name.trim(),
      description: dto.description ?? null,
      format: dto.format ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      discordGuildId: dto.discordGuildId ?? null,
      discordInviteUrl: dto.discordInviteUrl ?? null,
      ownerId,
      public: dto.public ?? true,
      scheduleSummary: dto.scheduleSummary ?? null,
      metadata: dto.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(leagues).values(row).returning();
    return ok(toLeagueDTO(inserted));
  }

  async getLeagueById(id: string, viewerUserId?: string): AsyncResult<LeagueDTO> {
    const result = await this.findVisibleLeague(eq(leagues.id, id), viewerUserId);
    return result.ok ? ok(toLeagueDTO(result.data)) : result.failure;
  }

  async getLeagueBySlug(slug: string, viewerUserId?: string): AsyncResult<LeagueDTO> {
    const result = await this.findVisibleLeague(eq(leagues.slug, slug), viewerUserId);
    return result.ok ? ok(toLeagueDTO(result.data)) : result.failure;
  }

  async listLeagues(opts: ListLeaguesOptions = {}): AsyncResult<LeagueDTO[]> {
    const conditions = [];
    if (opts.publicOnly !== false) conditions.push(eq(leagues.public, true));
    if (opts.ownerId) conditions.push(eq(leagues.ownerId, opts.ownerId));

    const rows = await db
      .select()
      .from(leagues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leagues.createdAt))
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);

    return ok(rows.map(toLeagueDTO));
  }

  async listLeaguesWithNextEvent(
    opts: ListLeaguesWithNextEventOptions = {},
  ): AsyncResult<LeagueWithNextEventDTO[]> {
    const leaguesResult = await this.listLeagues(opts);
    if (!leaguesResult.success) return leaguesResult;
    const leagueRows = leaguesResult.data;
    if (leagueRows.length === 0) return ok([]);

    // One pass to collect candidate events across all leagues. We over-fetch
    // private events and filter visibility per-league in JS — simpler than
    // expressing "public OR (private AND viewer is this league's owner)" in
    // a single SQL clause when each league has a different owner.
    const leagueIds = leagueRows.map(l => l.id);
    const now = new Date();
    const eventRows = await db
      .select()
      .from(leagueEvents)
      .where(and(
        inArray(leagueEvents.leagueId, leagueIds),
        gte(leagueEvents.scheduledFor, now),
        inArray(leagueEvents.status, ACTIVE_EVENT_STATUSES),
      ))
      .orderBy(asc(leagueEvents.scheduledFor));

    const byLeague = new Map<string, typeof eventRows[number][]>();
    for (const e of eventRows) {
      if (!byLeague.has(e.leagueId)) byLeague.set(e.leagueId, []);
      byLeague.get(e.leagueId)!.push(e);
    }

    const viewerUserId = opts.viewerUserId;
    const annotated: LeagueWithNextEventDTO[] = leagueRows.map(lg => {
      const isOwner = !!viewerUserId && lg.ownerId === viewerUserId;
      const candidates = byLeague.get(lg.id) ?? [];
      const visible = candidates.find(e => e.public || isOwner) ?? null;
      return { ...lg, nextEvent: visible ? toEventDTO(visible) : null };
    });
    return ok(annotated);
  }

  async updateLeague(
    leagueId: string,
    actingUserId: string,
    dto: UpdateLeagueDTO,
  ): AsyncResult<LeagueDTO> {
    const gate = await this.requireLeagueOwner(leagueId, actingUserId);
    if (!gate.ok) return gate.failure;

    const patch: Partial<typeof leagues.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.format !== undefined) patch.format = dto.format;
    if (dto.bannerUrl !== undefined) patch.bannerUrl = dto.bannerUrl;
    if (dto.discordGuildId !== undefined) patch.discordGuildId = dto.discordGuildId;
    if (dto.discordInviteUrl !== undefined) patch.discordInviteUrl = dto.discordInviteUrl;
    if (dto.public !== undefined) patch.public = dto.public;
    if (dto.scheduleSummary !== undefined) patch.scheduleSummary = dto.scheduleSummary;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;

    const [updated] = await db
      .update(leagues)
      .set(patch)
      .where(eq(leagues.id, leagueId))
      .returning();
    return ok(toLeagueDTO(updated));
  }

  async deleteLeague(leagueId: string, actingUserId: string): AsyncResult<{ deleted: true }> {
    const gate = await this.requireLeagueOwner(leagueId, actingUserId);
    if (!gate.ok) return gate.failure;

    // CASCADE handles events + result rows
    await db.delete(leagues).where(eq(leagues.id, leagueId));
    return ok({ deleted: true });
  }

  // ====================================================================
  // Events
  // ====================================================================

  async createEvent(
    leagueId: string,
    actingUserId: string,
    dto: CreateLeagueEventDTO,
  ): AsyncResult<LeagueEventDTO> {
    if (!dto.name?.trim()) return err('name is required');
    if (!dto.scheduledFor) return err('scheduledFor is required');

    const gate = await this.requireLeagueOwner(leagueId, actingUserId);
    if (!gate.ok) return gate.failure;

    const id = nanoid();
    const now = new Date();
    const row: typeof leagueEvents.$inferInsert = {
      id,
      leagueId,
      name: dto.name.trim(),
      description: dto.description ?? null,
      scheduledFor: normalizeDate(dto.scheduledFor),
      status: dto.status ?? 'upcoming',
      format: dto.format ?? null,
      public: dto.public ?? true,
      metadata: dto.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(leagueEvents).values(row).returning();
    return ok(toEventDTO(inserted));
  }

  async getEvent(eventId: string, viewerUserId?: string): AsyncResult<LeagueEventDTO> {
    const result = await this.loadVisibleEvent(eventId, viewerUserId);
    return result.ok ? ok(toEventDTO(result.data)) : result.failure;
  }

  async listEventsByLeague(
    leagueId: string,
    opts: ListEventsOptions = {},
  ): AsyncResult<LeagueEventDTO[]> {
    const [league] = await db.select({ public: leagues.public, ownerId: leagues.ownerId })
      .from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league) return err('league not found', 'not_found');

    const isOwner = league.ownerId === opts.viewerUserId;
    if (!league.public && !isOwner) return err('league not found', 'not_found');

    const conditions = [eq(leagueEvents.leagueId, leagueId)];
    if (!isOwner) conditions.push(eq(leagueEvents.public, true));
    if (opts.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
      conditions.push(inArray(leagueEvents.status, statuses));
    }

    const orderFn = opts.order === 'asc' ? asc : desc;
    const rows = await db
      .select()
      .from(leagueEvents)
      .where(and(...conditions))
      .orderBy(orderFn(leagueEvents.scheduledFor))
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);

    return ok(rows.map(toEventDTO));
  }

  async updateEvent(
    eventId: string,
    actingUserId: string,
    dto: UpdateLeagueEventDTO,
  ): AsyncResult<LeagueEventDTO> {
    const gate = await this.requireEventForOwner(eventId, actingUserId);
    if (!gate.ok) return gate.failure;

    const patch: Partial<typeof leagueEvents.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.scheduledFor !== undefined) patch.scheduledFor = normalizeDate(dto.scheduledFor);
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.format !== undefined) patch.format = dto.format;
    if (dto.public !== undefined) patch.public = dto.public;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;

    const [updated] = await db
      .update(leagueEvents)
      .set(patch)
      .where(eq(leagueEvents.id, eventId))
      .returning();
    return ok(toEventDTO(updated));
  }

  async deleteEvent(eventId: string, actingUserId: string): AsyncResult<{ deleted: true }> {
    const gate = await this.requireEventForOwner(eventId, actingUserId);
    if (!gate.ok) return gate.failure;

    await db.delete(leagueEvents).where(eq(leagueEvents.id, eventId));
    return ok({ deleted: true });
  }

  // ====================================================================
  // Event Results
  // ====================================================================

  async addEventResult(
    eventId: string,
    actingUserId: string,
    dto: AddEventResultDTO,
  ): AsyncResult<LeagueEventDeckDTO> {
    if (!dto.playerHandle?.trim()) return err('playerHandle is required');

    const gate = await this.requireEventForOwner(eventId, actingUserId);
    if (!gate.ok) return gate.failure;

    // Auto-fill heroName from the deck if a deckId was supplied and the
    // organizer didn't provide one explicitly. Denormalized so the result
    // survives deck deletion.
    let heroName = dto.heroName ?? null;
    if (!heroName && dto.deckId) {
      const [deck] = await db.select({ heroName: decks.heroName })
        .from(decks).where(eq(decks.id, dto.deckId)).limit(1);
      if (deck) heroName = deck.heroName ?? null;
    }

    const id = nanoid();
    const row: typeof leagueEventDecks.$inferInsert = {
      id,
      eventId,
      deckId: dto.deckId ?? null,
      userId: dto.userId ?? null,
      playerHandle: dto.playerHandle.trim(),
      heroName,
      placing: dto.placing ?? null,
      matchRecord: dto.matchRecord ?? null,
      droppedRound: dto.droppedRound ?? null,
      byes: dto.byes ?? null,
      metadata: dto.metadata ?? null,
      createdAt: new Date(),
    };
    const [inserted] = await db.insert(leagueEventDecks).values(row).returning();
    return ok(toResultDTO(inserted));
  }

  async listEventResults(
    eventId: string,
    viewerUserId?: string,
  ): AsyncResult<LeagueEventDeckDTO[]> {
    const gate = await this.loadVisibleEvent(eventId, viewerUserId);
    if (!gate.ok) return gate.failure;

    const rows = await db
      .select()
      .from(leagueEventDecks)
      .where(eq(leagueEventDecks.eventId, eventId))
      .orderBy(sql`${leagueEventDecks.placing} ASC NULLS LAST`);

    return ok(rows.map(toResultDTO));
  }

  async updateEventResult(
    resultId: string,
    actingUserId: string,
    dto: UpdateEventResultDTO,
  ): AsyncResult<LeagueEventDeckDTO> {
    const gate = await this.requireResultForOwner(resultId, actingUserId);
    if (!gate.ok) return gate.failure;

    const patch: Partial<typeof leagueEventDecks.$inferInsert> = {};
    if (dto.playerHandle !== undefined) patch.playerHandle = dto.playerHandle.trim();
    if (dto.deckId !== undefined) patch.deckId = dto.deckId;
    if (dto.userId !== undefined) patch.userId = dto.userId;
    if (dto.heroName !== undefined) patch.heroName = dto.heroName;
    if (dto.placing !== undefined) patch.placing = dto.placing;
    if (dto.matchRecord !== undefined) patch.matchRecord = dto.matchRecord;
    if (dto.droppedRound !== undefined) patch.droppedRound = dto.droppedRound;
    if (dto.byes !== undefined) patch.byes = dto.byes;
    if (dto.metadata !== undefined) patch.metadata = dto.metadata;

    const [updated] = await db
      .update(leagueEventDecks)
      .set(patch)
      .where(eq(leagueEventDecks.id, resultId))
      .returning();
    return ok(toResultDTO(updated));
  }

  async deleteEventResult(resultId: string, actingUserId: string): AsyncResult<{ deleted: true }> {
    const gate = await this.requireResultForOwner(resultId, actingUserId);
    if (!gate.ok) return gate.failure;

    await db.delete(leagueEventDecks).where(eq(leagueEventDecks.id, resultId));
    return ok({ deleted: true });
  }
}
