/**
 * Integration tests for PostgresLeagueService.
 *
 * Runs against the local Postgres DB (requires POSTGRES_URL in .env.local).
 *
 * Covers:
 * - league CRUD with slug uniqueness + owner enforcement
 * - event CRUD with privacy filtering (league + event public flags)
 * - event result CRUD with hero_name auto-fill from deck
 * - privacy: viewer who isn't the owner can't see private leagues/events
 * - cleanup verified — deleting a league cascades to events + results
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, leagues, leagueEvents, leagueEventDecks } from '@/lib/postgres/schema';
import { PostgresLeagueService } from './PostgresLeagueService';

const service = new PostgresLeagueService();

let ownerId: string;
let viewerId: string;
let heroPrintingId: string;
let deckId: string;

beforeEach(async () => {
  ownerId = crypto.randomUUID();
  viewerId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  await db.insert(users).values([
    { id: ownerId, username: `owner-${ownerId}` },
    { id: viewerId, username: `viewer-${viewerId}` },
  ]);

  // A real deck for hero_name auto-fill tests. The decks table requires a
  // unique userId+name pair; nanoid-style ID is sufficient.
  await db.insert(decks).values({
    id: deckId,
    publicId: deckId.slice(0, 12),
    userId: ownerId,
    name: `Test Deck ${deckId}`,
    heroName: 'Lyath Goldmane',
    visibility: 'public',
  });
});

afterEach(async () => {
  // Cleanup cascade: deleting users CASCADEs decks; leagues survive owner deletion
  // but we'll clean them up explicitly so the next test starts fresh.
  await db.delete(leagues).where(inArray(leagues.ownerId, [ownerId, viewerId]));
  await db.delete(users).where(inArray(users.id, [ownerId, viewerId]));
});

describe('PostgresLeagueService — leagues', () => {
  it('createLeague persists a new league with the given owner', async () => {
    const result = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Test League',
      discordGuildId: '1234567890',
      format: 'Silver Age',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ownerId).toBe(ownerId);
    expect(result.data.discordGuildId).toBe('1234567890');
    expect(result.data.public).toBe(true);
  });

  it('createLeague persists scheduleSummary (free-text cadence)', async () => {
    const result = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Cadence League',
      scheduleSummary: 'Every Sunday, 7pm UTC',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scheduleSummary).toBe('Every Sunday, 7pm UTC');
  });

  it('createLeague rejects duplicate slugs', async () => {
    const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
    const first = await service.createLeague(ownerId, { slug, name: 'First' });
    expect(first.success).toBe(true);

    const second = await service.createLeague(ownerId, { slug, name: 'Second' });
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.code).toBe('slug_taken');
  });

  it('createLeague rejects invalid slug formats', async () => {
    const result = await service.createLeague(ownerId, { slug: 'Has Spaces!', name: 'X' });
    expect(result.success).toBe(false);
  });

  it('getLeagueBySlug returns public league to anyone', async () => {
    const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
    await service.createLeague(ownerId, { slug, name: 'Pub' });
    const result = await service.getLeagueBySlug(slug, viewerId);
    expect(result.success).toBe(true);
  });

  it('getLeagueBySlug hides private league from non-owners', async () => {
    const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
    await service.createLeague(ownerId, { slug, name: 'Priv', public: false });
    const asViewer = await service.getLeagueBySlug(slug, viewerId);
    expect(asViewer.success).toBe(false);
    const asOwner = await service.getLeagueBySlug(slug, ownerId);
    expect(asOwner.success).toBe(true);
  });

  it('updateLeague requires the acting user to be the owner', async () => {
    const create = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Owned',
    });
    expect(create.success).toBe(true);
    if (!create.success) return;

    const denied = await service.updateLeague(create.data.id, viewerId, { name: 'Hijacked' });
    expect(denied.success).toBe(false);
    if (denied.success) return;
    expect(denied.code).toBe('forbidden');

    const ok = await service.updateLeague(create.data.id, ownerId, { name: 'Renamed' });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.name).toBe('Renamed');
  });

  it('deleteLeague cascades to events and results', async () => {
    const create = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'To Delete',
    });
    if (!create.success) throw new Error('setup failed');
    const leagueId = create.data.id;

    const evtRes = await service.createEvent(leagueId, ownerId, {
      name: 'Event 1',
      scheduledFor: new Date(),
    });
    if (!evtRes.success) throw new Error('event setup failed');

    await service.addEventResult(evtRes.data.id, ownerId, { playerHandle: 'p1' });

    const del = await service.deleteLeague(leagueId, ownerId);
    expect(del.success).toBe(true);

    const events = await db.select().from(leagueEvents).where(eq(leagueEvents.leagueId, leagueId));
    const results = await db.select().from(leagueEventDecks).where(eq(leagueEventDecks.eventId, evtRes.data.id));
    expect(events).toHaveLength(0);
    expect(results).toHaveLength(0);
  });
});

describe('PostgresLeagueService — listLeaguesWithNextEvent (directory)', () => {
  it('returns leagues annotated with their soonest upcoming/in_progress event', async () => {
    const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
    const lg = await service.createLeague(ownerId, { slug, name: 'L' });
    if (!lg.success) throw new Error('setup failed');

    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Past complete: should be ignored
    await service.createEvent(lg.data.id, ownerId, { name: 'Old', scheduledFor: past, status: 'complete' });
    // Future, but later: should be passed over for the sooner one
    await service.createEvent(lg.data.id, ownerId, { name: 'Later', scheduledFor: later });
    // Future, sooner: this is the expected next event
    await service.createEvent(lg.data.id, ownerId, { name: 'Soon', scheduledFor: soon });

    const result = await service.listLeaguesWithNextEvent({ ownerId });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const found = result.data.find(l => l.id === lg.data.id);
    expect(found).toBeDefined();
    expect(found!.nextEvent).not.toBeNull();
    expect(found!.nextEvent!.name).toBe('Soon');
  });

  it('returns nextEvent: null when the league has no upcoming events', async () => {
    const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
    const lg = await service.createLeague(ownerId, { slug, name: 'Empty' });
    if (!lg.success) throw new Error('setup failed');

    const result = await service.listLeaguesWithNextEvent({ ownerId });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const found = result.data.find(l => l.id === lg.data.id);
    expect(found).toBeDefined();
    expect(found!.nextEvent).toBeNull();
  });

  it('only counts public events for non-owners (private events are hidden from the directory)', async () => {
    const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
    const lg = await service.createLeague(ownerId, { slug, name: 'PublicLeague' });
    if (!lg.success) throw new Error('setup failed');

    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Sooner event is private; should be skipped for anonymous viewers
    await service.createEvent(lg.data.id, ownerId, { name: 'Hidden', scheduledFor: soon, public: false });
    await service.createEvent(lg.data.id, ownerId, { name: 'Visible', scheduledFor: later });

    const anon = await service.listLeaguesWithNextEvent();
    if (!anon.success) throw new Error('list failed');
    const fromAnon = anon.data.find(l => l.id === lg.data.id)!;
    expect(fromAnon.nextEvent?.name).toBe('Visible');

    const asOwner = await service.listLeaguesWithNextEvent({ viewerUserId: ownerId, ownerId });
    if (!asOwner.success) throw new Error('list failed');
    const fromOwner = asOwner.data.find(l => l.id === lg.data.id)!;
    expect(fromOwner.nextEvent?.name).toBe('Hidden');
  });
});

describe('PostgresLeagueService — events', () => {
  let leagueId: string;
  beforeEach(async () => {
    const create = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Test',
    });
    if (!create.success) throw new Error('setup failed');
    leagueId = create.data.id;
  });

  it('createEvent rejects callers that are not the league owner', async () => {
    const res = await service.createEvent(leagueId, viewerId, {
      name: 'Hijack Attempt',
      scheduledFor: new Date(),
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.code).toBe('forbidden');
  });

  it('listEventsByLeague hides private events from non-owners', async () => {
    await service.createEvent(leagueId, ownerId, {
      name: 'Public Event',
      scheduledFor: new Date(),
      public: true,
    });
    await service.createEvent(leagueId, ownerId, {
      name: 'Private Event',
      scheduledFor: new Date(),
      public: false,
    });

    const asViewer = await service.listEventsByLeague(leagueId, { viewerUserId: viewerId });
    expect(asViewer.success).toBe(true);
    if (!asViewer.success) return;
    expect(asViewer.data.map(e => e.name)).toEqual(['Public Event']);

    const asOwner = await service.listEventsByLeague(leagueId, { viewerUserId: ownerId });
    expect(asOwner.success).toBe(true);
    if (!asOwner.success) return;
    expect(asOwner.data.map(e => e.name).sort()).toEqual(['Private Event', 'Public Event']);
  });

  it('listEventsByLeague filters by status', async () => {
    await service.createEvent(leagueId, ownerId, { name: 'Done', scheduledFor: new Date(), status: 'complete' });
    await service.createEvent(leagueId, ownerId, { name: 'Soon', scheduledFor: new Date(), status: 'upcoming' });

    const res = await service.listEventsByLeague(leagueId, { viewerUserId: ownerId, status: 'upcoming' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.map(e => e.name)).toEqual(['Soon']);
  });
});

describe('PostgresLeagueService — event results', () => {
  let leagueId: string;
  let eventId: string;
  beforeEach(async () => {
    const lg = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Test',
    });
    if (!lg.success) throw new Error('setup failed');
    leagueId = lg.data.id;
    const evt = await service.createEvent(leagueId, ownerId, {
      name: 'E',
      scheduledFor: new Date(),
    });
    if (!evt.success) throw new Error('event setup failed');
    eventId = evt.data.id;
  });

  it('addEventResult denormalizes hero_name from the linked deck', async () => {
    const res = await service.addEventResult(eventId, ownerId, {
      playerHandle: 'TomasSolo',
      deckId,
      placing: 1,
      matchRecord: '5-1',
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.heroName).toBe('Lyath Goldmane');
  });

  it('addEventResult uses an explicit heroName even when no deck is linked', async () => {
    const res = await service.addEventResult(eventId, ownerId, {
      playerHandle: 'Anon',
      heroName: 'Briar',
      placing: 4,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.heroName).toBe('Briar');
    expect(res.data.deckId).toBeNull();
    expect(res.data.userId).toBeNull();
  });

  it('non-owners cannot add results', async () => {
    const res = await service.addEventResult(eventId, viewerId, { playerHandle: 'cheat' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.code).toBe('forbidden');
  });

  it('listEventResults orders by placing ASC NULLS LAST', async () => {
    await service.addEventResult(eventId, ownerId, { playerHandle: 'no-place' });
    await service.addEventResult(eventId, ownerId, { playerHandle: 'second', placing: 2 });
    await service.addEventResult(eventId, ownerId, { playerHandle: 'first', placing: 1 });

    const res = await service.listEventResults(eventId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.map(r => r.playerHandle)).toEqual(['first', 'second', 'no-place']);
  });
});

describe('PostgresLeagueService — user deletion behavior', () => {
  // Tracks leagues created in this block. afterEach's generic ownerId-based
  // delete misses these once the user-deletion trigger nulls out owner_id —
  // they'd otherwise leak across test runs (an earlier sweep accumulated
  // three "Survivor" orphans in the local DB).
  const orphanLeagueIds: string[] = [];
  afterEach(async () => {
    if (orphanLeagueIds.length > 0) {
      await db.delete(leagues).where(inArray(leagues.id, orphanLeagueIds));
      orphanLeagueIds.length = 0;
    }
  });

  it('user deletion sets league.owner_id NULL and scrubs player_handle', async () => {
    // Make a league + event + result tied to ownerId
    const lg = await service.createLeague(ownerId, {
      slug: `slug-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Survivor',
    });
    if (!lg.success) throw new Error('setup failed');
    orphanLeagueIds.push(lg.data.id);
    const evt = await service.createEvent(lg.data.id, ownerId, { name: 'E', scheduledFor: new Date() });
    if (!evt.success) throw new Error('event setup failed');

    const result = await service.addEventResult(evt.data.id, ownerId, {
      playerHandle: 'OriginalHandle',
      userId: ownerId,
      heroName: 'Lyath',
      placing: 1,
    });
    if (!result.success) throw new Error('result setup failed');

    // Delete the user — triggers FK SET NULL + scrub trigger
    await db.delete(users).where(eq(users.id, ownerId));

    // League survives, ownerless
    const [survivingLeague] = await db.select().from(leagues).where(eq(leagues.id, lg.data.id));
    expect(survivingLeague.ownerId).toBeNull();

    // Result row keeps hero/placing; handle scrubbed; user_id NULL
    const [survivingResult] = await db.select().from(leagueEventDecks).where(eq(leagueEventDecks.id, result.data.id));
    expect(survivingResult.userId).toBeNull();
    expect(survivingResult.playerHandle).toBe('[deleted player]');
    expect(survivingResult.heroName).toBe('Lyath');
    expect(survivingResult.placing).toBe(1);
  });

  it('leaves no orphan ownerless leagues behind (cleanup regression guard)', async () => {
    // RED-then-GREEN guard: any "test orphan" league must be cleaned up by
    // the suite. Before the orphanLeagueIds tracking, this assertion would
    // have failed because the previous test's league survived afterEach.
    const orphans = await db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .where(sql`${leagues.ownerId} IS NULL AND ${leagues.name} = 'Survivor'`);
    expect(orphans).toEqual([]);
  });
});
