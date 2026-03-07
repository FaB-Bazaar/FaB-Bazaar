import { db } from '@/lib/postgres/db';
import { events, eventAttendance, locations, users } from '@/lib/postgres/schema';
import { eq, and, sql, gte, asc, desc, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { IEventService, UpcomingEventsFilters } from '../../contracts/IEventService';
import type { AsyncResult } from '../../contracts/common';
import type {
  EventDTO,
  EventSummaryDTO,
  EventAttendeeDTO,
  CreateEventDTO,
  UpdateEventDTO,
  LocationPaginationOptions,
} from '@/types/location';

export class PostgresEventService implements IEventService {
  // ============================================================================
  // Helpers
  // ============================================================================

  private rowToEventDTO(row: any): EventDTO {
    return {
      id: row.id,
      locationId: row.locationId,
      locationName: row.locationName ?? '',
      name: row.name,
      type: row.type,
      format: row.format,
      startDate: row.startDate,
      endDate: row.endDate,
      registrationUrl: row.registrationUrl,
      discordInviteUrl: row.discordInviteUrl,
      notes: row.notes,
      active: row.active,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ============================================================================
  // Lookup
  // ============================================================================

  async getEventById(id: string): AsyncResult<EventDTO | null> {
    try {
      const rows = await db
        .select({
          id: events.id,
          locationId: events.locationId,
          locationName: locations.name,
          name: events.name,
          type: events.type,
          format: events.format,
          startDate: events.startDate,
          endDate: events.endDate,
          registrationUrl: events.registrationUrl,
          discordInviteUrl: events.discordInviteUrl,
          notes: events.notes,
          active: events.active,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .innerJoin(locations, eq(events.locationId, locations.id))
        .where(eq(events.id, id))
        .limit(1);

      if (!rows.length) return { success: true, data: null };
      return { success: true, data: this.rowToEventDTO(rows[0]) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getEventsAtLocation(
    locationId: string,
    options: { includeEnded?: boolean } = {}
  ): AsyncResult<EventDTO[]> {
    try {
      const conditions = [eq(events.locationId, locationId)];

      if (!options.includeEnded) {
        conditions.push(gte(events.endDate, new Date()));
      }

      const rows = await db
        .select({
          id: events.id,
          locationId: events.locationId,
          locationName: locations.name,
          name: events.name,
          type: events.type,
          format: events.format,
          startDate: events.startDate,
          endDate: events.endDate,
          registrationUrl: events.registrationUrl,
          discordInviteUrl: events.discordInviteUrl,
          notes: events.notes,
          active: events.active,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .innerJoin(locations, eq(events.locationId, locations.id))
        .where(and(...conditions))
        .orderBy(asc(events.startDate));

      return { success: true, data: rows.map((r) => this.rowToEventDTO(r)) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getUpcomingEvents(
    filters: UpcomingEventsFilters = {},
    pagination: LocationPaginationOptions = {}
  ): AsyncResult<{ events: EventSummaryDTO[]; total: number }> {
    try {
      const { page = 1, limit = 20 } = pagination;
      const offset = (page - 1) * limit;
      const now = new Date();

      const conditions = [gte(events.endDate, now), eq(events.active, true)];

      if (filters.locationId) {
        conditions.push(eq(events.locationId, filters.locationId));
      }
      if (filters.type) {
        conditions.push(eq(events.type, filters.type as any));
      }
      if (filters.country) {
        conditions.push(eq(locations.addressCountry, filters.country.toUpperCase()));
      }

      const where = and(...conditions);

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: events.id,
            locationId: events.locationId,
            locationName: locations.name,
            name: events.name,
            type: events.type,
            format: events.format,
            startDate: events.startDate,
            endDate: events.endDate,
            attendeeCount: sql<number>`(
              SELECT count(*)::int FROM event_attendance
              WHERE event_id = ${events.id}
            )`,
          })
          .from(events)
          .innerJoin(locations, eq(events.locationId, locations.id))
          .where(where)
          .orderBy(asc(events.startDate))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(events)
          .innerJoin(locations, eq(events.locationId, locations.id))
          .where(where),
      ]);

      return {
        success: true,
        data: {
          events: rows.map((r) => ({
            id: r.id,
            locationId: r.locationId,
            locationName: r.locationName,
            name: r.name,
            type: r.type,
            format: r.format,
            startDate: r.startDate,
            endDate: r.endDate,
            attendeeCount: r.attendeeCount,
          })),
          total: totalResult[0]?.total ?? 0,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Attendance
  // ============================================================================

  async attendEvent(eventId: string, userId: string, bringingTrades = true): AsyncResult<boolean> {
    try {
      await db
        .insert(eventAttendance)
        .values({ eventId, userId, bringingTrades })
        .onConflictDoUpdate({
          target: [eventAttendance.eventId, eventAttendance.userId],
          set: { bringingTrades },
        });
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async cancelAttendance(eventId: string, userId: string): AsyncResult<boolean> {
    try {
      await db
        .delete(eventAttendance)
        .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)));
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getEventAttendees(eventId: string): AsyncResult<EventAttendeeDTO[]> {
    try {
      const rows = await db
        .select({
          userId: users.id,
          username: users.username,
          displayUsername: users.displayUsername,
          avatarUrl: users.avatarUrl,
          bringingTrades: eventAttendance.bringingTrades,
          createdAt: eventAttendance.createdAt,
        })
        .from(eventAttendance)
        .innerJoin(users, eq(eventAttendance.userId, users.id))
        .where(eq(eventAttendance.eventId, eventId))
        .orderBy(asc(eventAttendance.createdAt));

      return {
        success: true,
        data: rows.map((r) => ({
          userId: r.userId,
          username: r.username,
          displayUsername: r.displayUsername,
          avatarUrl: r.avatarUrl,
          bringingTrades: r.bringingTrades,
          createdAt: r.createdAt,
        })),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getUserUpcomingEvents(userId: string): AsyncResult<EventDTO[]> {
    try {
      const now = new Date();
      const rows = await db
        .select({
          id: events.id,
          locationId: events.locationId,
          locationName: locations.name,
          name: events.name,
          type: events.type,
          format: events.format,
          startDate: events.startDate,
          endDate: events.endDate,
          registrationUrl: events.registrationUrl,
          discordInviteUrl: events.discordInviteUrl,
          notes: events.notes,
          active: events.active,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        })
        .from(eventAttendance)
        .innerJoin(events, eq(eventAttendance.eventId, events.id))
        .innerJoin(locations, eq(events.locationId, locations.id))
        .where(and(eq(eventAttendance.userId, userId), gte(events.endDate, now)))
        .orderBy(asc(events.startDate));

      return { success: true, data: rows.map((r) => this.rowToEventDTO(r)) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async isAttending(eventId: string, userId: string): AsyncResult<boolean> {
    try {
      const rows = await db
        .select({ eventId: eventAttendance.eventId })
        .from(eventAttendance)
        .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)))
        .limit(1);
      return { success: true, data: rows.length > 0 };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Admin CRUD
  // ============================================================================

  async createEvent(data: CreateEventDTO, createdBy?: string): AsyncResult<EventDTO> {
    try {
      // Validate location exists
      const locationRows = await db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(eq(locations.id, data.locationId))
        .limit(1);

      if (!locationRows.length) {
        return { success: false, error: 'Location not found' };
      }

      const id = nanoid();
      await db.insert(events).values({
        id,
        locationId: data.locationId,
        name: data.name,
        type: data.type ?? 'other',
        format: data.format ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        registrationUrl: data.registrationUrl ?? null,
        discordInviteUrl: data.discordInviteUrl ?? null,
        notes: data.notes ?? null,
        active: data.active ?? true,
        createdBy: createdBy ?? null,
      });

      return {
        success: true,
        data: this.rowToEventDTO({
          id,
          locationId: data.locationId,
          locationName: locationRows[0].name,
          name: data.name,
          type: data.type ?? 'other',
          format: data.format ?? null,
          startDate: data.startDate,
          endDate: data.endDate,
          registrationUrl: data.registrationUrl ?? null,
          discordInviteUrl: data.discordInviteUrl ?? null,
          notes: data.notes ?? null,
          active: data.active ?? true,
          createdBy: createdBy ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateEvent(id: string, data: UpdateEventDTO): AsyncResult<EventDTO> {
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.type !== undefined) updates.type = data.type;
      if (data.format !== undefined) updates.format = data.format;
      if (data.startDate !== undefined) updates.startDate = data.startDate;
      if (data.endDate !== undefined) updates.endDate = data.endDate;
      if (data.registrationUrl !== undefined) updates.registrationUrl = data.registrationUrl;
      if (data.discordInviteUrl !== undefined) updates.discordInviteUrl = data.discordInviteUrl;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.active !== undefined) updates.active = data.active;

      await db.update(events).set(updates).where(eq(events.id, id));

      const result = await this.getEventById(id);
      if (!result.success) return result;
      if (!result.data) return { success: false, error: 'Event not found' };
      return { success: true, data: result.data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteEvent(id: string): AsyncResult<boolean> {
    try {
      await db.delete(events).where(eq(events.id, id));
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
