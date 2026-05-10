/**
 * League Service Contract
 *
 * Database-agnostic interface for community-run league operations.
 * See migration 0047_add_leagues.sql for the underlying schema and
 * the privacy / cascade design.
 *
 * Role gating happens at the API layer (curator/superadmin checks live
 * with the route, mirroring the curated-lists pattern). The service
 * itself only enforces ownership — the caller passes `actingUserId`
 * and the service verifies that user owns the league before mutating.
 *
 * Visibility (`public` flag on leagues and events) is enforced in read
 * methods: passing `viewerUserId` lets owners see their own private
 * content; everyone else gets the public-only view.
 */

import type { AsyncResult } from './common';

// ============================================================================
// DTOs
// ============================================================================

export type LeagueEventStatus = 'upcoming' | 'in_progress' | 'complete' | 'cancelled';

export interface LeagueDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  format: string | null;
  bannerUrl: string | null;
  discordGuildId: string | null;
  discordInviteUrl: string | null;
  ownerId: string | null;            // null if creator deleted their account
  public: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueEventDTO {
  id: string;
  leagueId: string;
  name: string;
  description: string | null;
  scheduledFor: Date;
  status: LeagueEventStatus;
  format: string | null;             // override of league.format
  public: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueEventDeckDTO {
  id: string;
  eventId: string;
  deckId: string | null;
  userId: string | null;
  playerHandle: string;              // Discord username or anonymous tag
  heroName: string | null;           // denormalized so result survives deck deletion
  placing: number | null;
  matchRecord: string | null;        // free-form, e.g. "5-1-0"
  droppedRound: number | null;
  byes: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================================================
// Create / Update payloads
// ============================================================================

export interface CreateLeagueDTO {
  slug: string;
  name: string;
  description?: string;
  format?: string;
  bannerUrl?: string;
  discordGuildId?: string;
  discordInviteUrl?: string;
  public?: boolean;                  // defaults to true
  metadata?: Record<string, unknown>;
}

export interface UpdateLeagueDTO {
  name?: string;
  description?: string | null;
  format?: string | null;
  bannerUrl?: string | null;
  discordGuildId?: string | null;
  discordInviteUrl?: string | null;
  public?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CreateLeagueEventDTO {
  name: string;
  description?: string;
  scheduledFor: Date | string;       // ISO string also accepted
  status?: LeagueEventStatus;        // defaults to 'upcoming'
  format?: string;
  public?: boolean;                  // defaults to true
  metadata?: Record<string, unknown>;
}

export interface UpdateLeagueEventDTO {
  name?: string;
  description?: string | null;
  scheduledFor?: Date | string;
  status?: LeagueEventStatus;
  format?: string | null;
  public?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface AddEventResultDTO {
  playerHandle: string;
  deckId?: string | null;
  userId?: string | null;
  heroName?: string | null;          // organizer can pass it directly; service also auto-fills from deck when deckId is set
  placing?: number;
  matchRecord?: string;
  droppedRound?: number;
  byes?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateEventResultDTO {
  playerHandle?: string;
  deckId?: string | null;
  userId?: string | null;
  heroName?: string | null;
  placing?: number | null;
  matchRecord?: string | null;
  droppedRound?: number | null;
  byes?: number | null;
  metadata?: Record<string, unknown> | null;
}

// ============================================================================
// Filters
// ============================================================================

export interface ListLeaguesOptions {
  /** When true, include only public leagues. Defaults to true. */
  publicOnly?: boolean;
  /** Restrict to leagues owned by this user. */
  ownerId?: string;
  /** Pagination */
  limit?: number;
  offset?: number;
}

export interface ListEventsOptions {
  /**
   * Viewer's user id. When set and matching the league owner, includes
   * private events. Otherwise, private events are filtered out.
   */
  viewerUserId?: string;
  /** Restrict by status (one or many). */
  status?: LeagueEventStatus | LeagueEventStatus[];
  /** Defaults to scheduledFor DESC. */
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================================================
// Service interface
// ============================================================================

export interface ILeagueService {
  // ---------- Leagues ----------
  createLeague(ownerId: string, dto: CreateLeagueDTO): AsyncResult<LeagueDTO>;
  getLeagueById(id: string, viewerUserId?: string): AsyncResult<LeagueDTO>;
  getLeagueBySlug(slug: string, viewerUserId?: string): AsyncResult<LeagueDTO>;
  listLeagues(opts?: ListLeaguesOptions): AsyncResult<LeagueDTO[]>;
  updateLeague(leagueId: string, actingUserId: string, dto: UpdateLeagueDTO): AsyncResult<LeagueDTO>;
  deleteLeague(leagueId: string, actingUserId: string): AsyncResult<{ deleted: true }>;

  // ---------- Events ----------
  createEvent(leagueId: string, actingUserId: string, dto: CreateLeagueEventDTO): AsyncResult<LeagueEventDTO>;
  getEvent(eventId: string, viewerUserId?: string): AsyncResult<LeagueEventDTO>;
  listEventsByLeague(leagueId: string, opts?: ListEventsOptions): AsyncResult<LeagueEventDTO[]>;
  updateEvent(eventId: string, actingUserId: string, dto: UpdateLeagueEventDTO): AsyncResult<LeagueEventDTO>;
  deleteEvent(eventId: string, actingUserId: string): AsyncResult<{ deleted: true }>;

  // ---------- Event Results (decks) ----------
  addEventResult(eventId: string, actingUserId: string, dto: AddEventResultDTO): AsyncResult<LeagueEventDeckDTO>;
  listEventResults(eventId: string, viewerUserId?: string): AsyncResult<LeagueEventDeckDTO[]>;
  updateEventResult(resultId: string, actingUserId: string, dto: UpdateEventResultDTO): AsyncResult<LeagueEventDeckDTO>;
  deleteEventResult(resultId: string, actingUserId: string): AsyncResult<{ deleted: true }>;
}
