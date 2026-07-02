import { db } from '@/lib/postgres/db';
import {
  locations,
  users,
  countries,
  states,
  userFollowedStores,
  locationManagers,
  locationSubmissions,
  events,
  eventAttendance,
} from '@/lib/postgres/schema';
import { eq, and, sql, ilike, or, desc, asc, count, gt, gte, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { encryptAddress, decryptAddress } from '@/lib/encryption';
import type { ILocationService } from '../../contracts/ILocationService';
import type { AsyncResult } from '../../contracts/common';
import type {
  LocationDTO,
  LocationSummaryDTO,
  LocationFollowerDTO,
  LocationManagerDTO,
  LocationSubmissionDTO,
  CountryDTO,
  StateDTO,
  StoresContextDTO,
  EventSummaryDTO,
  BrowseLocationFilters,
  LocationPaginationOptions,
  CreateLocationDTO,
  UpdateLocationDTO,
  CreateSubmissionDTO,
  BrowseSubmissionsFilters,
} from '@/types/location';

export class PostgresLocationService implements ILocationService {
  // ============================================================================
  // Helpers
  // ============================================================================

  private encryptEmail(email: string | undefined | null): { encrypted: string | null; iv: string | null } {
    if (!email) return { encrypted: null, iv: null };
    const result = encryptAddress(email);
    return { encrypted: result.encrypted || null, iv: result.iv || null };
  }

  private decryptEmail(encrypted: string | null | undefined, iv: string | null | undefined): string | null {
    if (!encrypted || !iv) return null;
    return decryptAddress({ encrypted, iv, tag: '' }) || null;
  }

  private rowToLocationDTO(row: any): LocationDTO {
    return {
      id: row.id,
      category: row.category,
      name: row.name,
      addressLine1: row.addressLine1,
      addressCity: row.addressCity,
      addressState: row.addressState,
      addressPostalCode: row.addressPostalCode,
      addressCountry: row.addressCountry,
      addressCountryId: row.addressCountryId,
      addressStateId: row.addressStateId,
      contactPhone: row.contactPhone,
      contactEmail: this.decryptEmail(row.contactEmail, row.contactEmailIv),
      contactWebsite: row.contactWebsite,
      tcgplayerId: row.tcgplayerId,
      googlePlaceId: row.googlePlaceId,
      facebookId: row.facebookId,
      tcgplayerStorefrontUrl: row.tcgplayerStorefrontUrl,
      discordInviteUrl: row.discordInviteUrl,
      tags: row.tags ?? [],
      active: row.active,
      geoLat: row.geoLat,
      geoLng: row.geoLng,
      images: row.images ?? [],
      managerName: row.managerName,
      managerEmail: this.decryptEmail(row.managerEmail, row.managerEmailIv),
      managerPhone: row.managerPhone,
      notes: row.notes,
      followerCount: row.followerCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToLocationSummaryDTO(row: any): LocationSummaryDTO {
    return {
      id: row.id,
      category: row.category,
      name: row.name,
      addressCity: row.addressCity,
      addressState: row.addressState,
      addressCountry: row.addressCountry,
      tags: row.tags ?? [],
      active: row.active,
      followerCount: row.followerCount,
    };
  }

  // ============================================================================
  // Browse & Lookup
  // ============================================================================

  async getLocationById(id: string): AsyncResult<LocationDTO | null> {
    try {
      const rows = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
      if (!rows.length) return { success: true, data: null };
      return { success: true, data: this.rowToLocationDTO(rows[0]) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async browseLocations(
    filters: BrowseLocationFilters,
    pagination: LocationPaginationOptions = {}
  ): AsyncResult<{ locations: LocationSummaryDTO[]; total: number }> {
    try {
      const { page = 1, limit = 20 } = pagination;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (filters.active !== undefined) {
        conditions.push(eq(locations.active, filters.active));
      } else {
        conditions.push(eq(locations.active, true));
      }

      if (filters.category) {
        conditions.push(eq(locations.category, filters.category));
      }

      if (filters.country) {
        conditions.push(eq(locations.addressCountry, filters.country.toUpperCase()));
      }

      if (filters.state) {
        conditions.push(eq(locations.addressState, filters.state.toUpperCase()));
      }

      if (filters.search) {
        conditions.push(
          sql`to_tsvector('english'::regconfig, ${locations.name}) @@ plainto_tsquery('english'::regconfig, ${filters.search})`
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: locations.id,
            category: locations.category,
            name: locations.name,
            addressCity: locations.addressCity,
            addressState: locations.addressState,
            addressCountry: locations.addressCountry,
            tags: locations.tags,
            active: locations.active,
            followerCount: locations.followerCount,
          })
          .from(locations)
          .where(where)
          .orderBy(asc(locations.name))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(locations).where(where),
      ]);

      return {
        success: true,
        data: {
          locations: rows.map((r) => this.rowToLocationSummaryDTO(r)),
          total: totalResult[0]?.total ?? 0,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Follows
  // ============================================================================

  async followLocation(userId: string, locationId: string): AsyncResult<boolean> {
    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(userFollowedStores)
          .values({ userId, locationId })
          .onConflictDoNothing();
        await tx
          .update(locations)
          .set({ followerCount: sql`${locations.followerCount} + 1` })
          .where(eq(locations.id, locationId));
      });
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async unfollowLocation(userId: string, locationId: string): AsyncResult<boolean> {
    try {
      await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(userFollowedStores)
          .where(and(eq(userFollowedStores.userId, userId), eq(userFollowedStores.locationId, locationId)))
          .returning();
        if (deleted.length > 0) {
          await tx
            .update(locations)
            .set({ followerCount: sql`greatest(${locations.followerCount} - 1, 0)` })
            .where(eq(locations.id, locationId));
        }
      });
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getUserFollowedStores(userId: string): AsyncResult<LocationSummaryDTO[]> {
    try {
      const rows = await db
        .select({
          id: locations.id,
          category: locations.category,
          name: locations.name,
          addressCity: locations.addressCity,
          addressState: locations.addressState,
          addressCountry: locations.addressCountry,
          tags: locations.tags,
          active: locations.active,
          followerCount: locations.followerCount,
        })
        .from(userFollowedStores)
        .innerJoin(locations, eq(userFollowedStores.locationId, locations.id))
        .where(eq(userFollowedStores.userId, userId))
        .orderBy(asc(locations.name));

      return { success: true, data: rows.map((r) => this.rowToLocationSummaryDTO(r)) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getLocationFollowers(
    locationId: string,
    pagination: LocationPaginationOptions = {}
  ): AsyncResult<{ followers: LocationFollowerDTO[]; total: number }> {
    try {
      const { page = 1, limit = 50 } = pagination;
      const offset = (page - 1) * limit;

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            userId: users.id,
            username: users.username,
            displayUsername: users.displayUsername,
            avatarUrl: users.avatarUrl,
            discordId: users.discordId,
            discordAvatar: users.discordAvatar,
            followedAt: userFollowedStores.followedAt,
          })
          .from(userFollowedStores)
          .innerJoin(users, eq(userFollowedStores.userId, users.id))
          .where(eq(userFollowedStores.locationId, locationId))
          .orderBy(desc(userFollowedStores.followedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(userFollowedStores)
          .where(eq(userFollowedStores.locationId, locationId)),
      ]);

      return {
        success: true,
        data: {
          followers: rows.map((r) => ({
            userId: r.userId,
            username: r.username,
            displayUsername: r.displayUsername,
            avatarUrl: r.avatarUrl ?? r.discordAvatar ?? null,
            followedAt: r.followedAt,
          })),
          total: totalResult[0]?.total ?? 0,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async isFollowing(userId: string, locationId: string): AsyncResult<boolean> {
    try {
      const rows = await db
        .select({ userId: userFollowedStores.userId })
        .from(userFollowedStores)
        .where(and(eq(userFollowedStores.userId, userId), eq(userFollowedStores.locationId, locationId)))
        .limit(1);
      return { success: true, data: rows.length > 0 };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Stores Context
  // ============================================================================

  async getUserStoresContext(userId: string): AsyncResult<StoresContextDTO> {
    try {
      const userRows = await db
        .select({ countryCode: users.countryCode, stateCode: users.stateCode })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const countryCode = userRows[0]?.countryCode ?? null;
      const stateCode = userRows[0]?.stateCode ?? null;

      const followedResult = await this.getUserFollowedStores(userId);
      const followedStores = followedResult.success ? followedResult.data : [];

      // Upcoming events at followed locations
      const followedLocationIds = followedStores.map((s) => s.id);
      let upcomingEvents: EventSummaryDTO[] = [];

      if (followedLocationIds.length > 0) {
        const now = new Date();
        const eventRows = await db
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
          .where(
            and(
              inArray(events.locationId, followedLocationIds),
              gte(events.endDate, now),
              eq(events.active, true)
            )
          )
          .orderBy(asc(events.startDate))
          .limit(20);

        upcomingEvents = eventRows.map((r) => ({
          id: r.id,
          locationId: r.locationId,
          locationName: r.locationName,
          name: r.name,
          type: r.type,
          format: r.format,
          startDate: r.startDate,
          endDate: r.endDate,
          attendeeCount: r.attendeeCount,
        }));
      }

      return {
        success: true,
        data: { countryCode, stateCode, followedStores, upcomingEvents },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Nearby Users (trade matching helper)
  // ============================================================================

  async getNearbyUsers(userId: string): AsyncResult<string[]> {
    try {
      const result = await db.execute<{ other_user_id: string }>(sql`
        SELECT DISTINCT other_user_id FROM (
          -- Store followers at my followed locations
          SELECT ufs.user_id AS other_user_id
          FROM user_followed_stores ufs
          WHERE ufs.location_id IN (
            SELECT location_id FROM user_followed_stores WHERE user_id = ${userId}
          )
          AND ufs.user_id != ${userId}

          UNION

          -- Event attendees at my active events
          SELECT ea.user_id AS other_user_id
          FROM event_attendance ea
          JOIN events e ON e.id = ea.event_id
          WHERE e.location_id IN (
            SELECT location_id FROM user_followed_stores WHERE user_id = ${userId}
            UNION
            SELECT e2.location_id FROM event_attendance ea2
            JOIN events e2 ON e2.id = ea2.event_id
            WHERE ea2.user_id = ${userId} AND e2.end_date >= now()
          )
          AND ea.user_id != ${userId}
          AND e.end_date >= now()
          AND ea.bringing_trades = true
        ) nearby_users
      `);

      const userIds = (result.rows ?? result as any[]).map((r: any) => r.other_user_id);
      return { success: true, data: userIds };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Managers
  // ============================================================================

  async getLocationManagers(locationId: string): AsyncResult<LocationManagerDTO[]> {
    try {
      const rows = await db
        .select({
          userId: users.id,
          username: users.username,
          displayUsername: users.displayUsername,
          avatarUrl: users.avatarUrl,
          assignedAt: locationManagers.assignedAt,
        })
        .from(locationManagers)
        .innerJoin(users, eq(locationManagers.userId, users.id))
        .where(eq(locationManagers.locationId, locationId))
        .orderBy(asc(locationManagers.assignedAt));

      return {
        success: true,
        data: rows.map((r) => ({
          userId: r.userId,
          username: r.username,
          displayUsername: r.displayUsername,
          avatarUrl: r.avatarUrl,
          assignedAt: r.assignedAt,
        })),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async addManager(locationId: string, userId: string): AsyncResult<boolean> {
    try {
      await db
        .insert(locationManagers)
        .values({ locationId, userId })
        .onConflictDoNothing();
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async removeManager(locationId: string, userId: string): AsyncResult<boolean> {
    try {
      await db
        .delete(locationManagers)
        .where(and(eq(locationManagers.locationId, locationId), eq(locationManagers.userId, userId)));
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async canManageLocation(userId: string, locationId: string): AsyncResult<boolean> {
    try {
      const userRows = await db
        .select({ isAdmin: users.isAdmin, canManageLocations: users.canManageLocations })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userRows.length) return { success: true, data: false };
      const user = userRows[0];

      if (user.isAdmin || user.canManageLocations) return { success: true, data: true };

      const managerRows = await db
        .select({ userId: locationManagers.userId })
        .from(locationManagers)
        .where(and(eq(locationManagers.locationId, locationId), eq(locationManagers.userId, userId)))
        .limit(1);

      return { success: true, data: managerRows.length > 0 };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Admin CRUD
  // ============================================================================

  async createLocation(data: CreateLocationDTO): AsyncResult<LocationDTO> {
    try {
      const id = nanoid();
      const contactEmailEnc = this.encryptEmail(data.contactEmail);
      const managerEmailEnc = this.encryptEmail(data.managerEmail);

      await db.insert(locations).values({
        id,
        category: data.category ?? 'store',
        name: data.name,
        addressLine1: data.addressLine1,
        addressCity: data.addressCity,
        addressState: data.addressState ?? null,
        addressPostalCode: data.addressPostalCode ?? null,
        addressCountry: data.addressCountry,
        addressCountryId: data.addressCountryId ?? null,
        addressStateId: data.addressStateId ?? null,
        contactPhone: data.contactPhone ?? null,
        contactEmail: contactEmailEnc.encrypted,
        contactEmailIv: contactEmailEnc.iv,
        contactWebsite: data.contactWebsite ?? null,
        tcgplayerId: data.tcgplayerId ?? null,
        googlePlaceId: data.googlePlaceId ?? null,
        facebookId: data.facebookId ?? null,
        tcgplayerStorefrontUrl: data.tcgplayerStorefrontUrl ?? null,
        discordInviteUrl: data.discordInviteUrl ?? null,
        tags: data.tags ?? [],
        active: data.active ?? true,
        geoLat: data.geoLat ?? null,
        geoLng: data.geoLng ?? null,
        images: data.images ?? [],
        managerName: data.managerName ?? null,
        managerEmail: managerEmailEnc.encrypted,
        managerEmailIv: managerEmailEnc.iv,
        managerPhone: data.managerPhone ?? null,
        notes: data.notes ?? null,
      });

      const created = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
      return { success: true, data: this.rowToLocationDTO(created[0]) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateLocation(id: string, data: UpdateLocationDTO): AsyncResult<LocationDTO> {
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };

      if (data.category !== undefined) updates.category = data.category;
      if (data.name !== undefined) updates.name = data.name;
      if (data.addressLine1 !== undefined) updates.addressLine1 = data.addressLine1;
      if (data.addressCity !== undefined) updates.addressCity = data.addressCity;
      if (data.addressState !== undefined) updates.addressState = data.addressState;
      if (data.addressPostalCode !== undefined) updates.addressPostalCode = data.addressPostalCode;
      if (data.addressCountry !== undefined) updates.addressCountry = data.addressCountry;
      if (data.addressCountryId !== undefined) updates.addressCountryId = data.addressCountryId;
      if (data.addressStateId !== undefined) updates.addressStateId = data.addressStateId;
      if (data.contactPhone !== undefined) updates.contactPhone = data.contactPhone;
      if (data.contactEmail !== undefined) {
        const enc = this.encryptEmail(data.contactEmail);
        updates.contactEmail = enc.encrypted;
        updates.contactEmailIv = enc.iv;
      }
      if (data.contactWebsite !== undefined) updates.contactWebsite = data.contactWebsite;
      if (data.tcgplayerId !== undefined) updates.tcgplayerId = data.tcgplayerId;
      if (data.googlePlaceId !== undefined) updates.googlePlaceId = data.googlePlaceId;
      if (data.facebookId !== undefined) updates.facebookId = data.facebookId;
      if (data.tcgplayerStorefrontUrl !== undefined) updates.tcgplayerStorefrontUrl = data.tcgplayerStorefrontUrl;
      if (data.discordInviteUrl !== undefined) updates.discordInviteUrl = data.discordInviteUrl;
      if (data.tags !== undefined) updates.tags = data.tags;
      if (data.active !== undefined) updates.active = data.active;
      if (data.geoLat !== undefined) updates.geoLat = data.geoLat;
      if (data.geoLng !== undefined) updates.geoLng = data.geoLng;
      if (data.images !== undefined) updates.images = data.images;
      if (data.managerName !== undefined) updates.managerName = data.managerName;
      if (data.managerEmail !== undefined) {
        const enc = this.encryptEmail(data.managerEmail);
        updates.managerEmail = enc.encrypted;
        updates.managerEmailIv = enc.iv;
      }
      if (data.managerPhone !== undefined) updates.managerPhone = data.managerPhone;
      if (data.notes !== undefined) updates.notes = data.notes;

      await db.update(locations).set(updates).where(eq(locations.id, id));
      const updated = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
      if (!updated.length) return { success: false, error: 'Location not found' };
      return { success: true, data: this.rowToLocationDTO(updated[0]) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteLocation(id: string): AsyncResult<boolean> {
    try {
      await db.delete(locations).where(eq(locations.id, id));
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Geo
  // ============================================================================

  async getCountries(): AsyncResult<CountryDTO[]> {
    try {
      const rows = await db
        .select({
          id: countries.id,
          name: countries.name,
          iso2: countries.iso2,
          iso3: countries.iso3,
          phoneCode: countries.phoneCode,
        })
        .from(countries)
        .orderBy(asc(countries.name));

      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getStates(countryIso2: string): AsyncResult<{ id: number; name: string; stateCode: string; countryId: number }[]> {
    try {
      const countryRows = await db
        .select({ id: countries.id })
        .from(countries)
        .where(eq(countries.iso2, countryIso2.toUpperCase()))
        .limit(1);

      if (!countryRows.length) return { success: true, data: [] };

      const rows = await db
        .select({
          id: states.id,
          name: states.name,
          stateCode: states.stateCode,
          countryId: states.countryId,
        })
        .from(states)
        .where(eq(states.countryId, countryRows[0].id))
        .orderBy(asc(states.name));

      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Submissions
  // ============================================================================

  async createSubmission(data: CreateSubmissionDTO): AsyncResult<LocationSubmissionDTO> {
    try {
      const id = nanoid();
      await db.insert(locationSubmissions).values({
        id,
        submitterName: data.submitterName,
        submittedByUserId: data.submittedByUserId,
        submitterPhone: data.submitterPhone ?? null,
        submitterRelationship: data.submitterRelationship,
        storeName: data.storeName,
        storeAddressLine1: data.storeAddressLine1,
        storeAddressCity: data.storeAddressCity,
        storeAddressState: data.storeAddressState,
        storeAddressPostalCode: data.storeAddressPostalCode,
        storeAddressCountry: data.storeAddressCountry,
        storeContactPhone: data.storeContactPhone ?? null,
        storeContactEmail: data.storeContactEmail ?? null,
        storeContactWebsite: data.storeContactWebsite ?? null,
        storeManagerName: data.storeManagerName ?? null,
        storeManagerEmail: data.storeManagerEmail ?? null,
        storeManagerPhone: data.storeManagerPhone ?? null,
        tcgplayerStorefrontUrl: data.tcgplayerStorefrontUrl ?? null,
        discordInviteUrl: data.discordInviteUrl ?? null,
        notes: data.notes ?? null,
      });

      const created = await db
        .select()
        .from(locationSubmissions)
        .where(eq(locationSubmissions.id, id))
        .limit(1);

      return { success: true, data: this.rowToSubmissionDTO(created[0]) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async listSubmissions(
    filters: BrowseSubmissionsFilters = {},
    pagination: LocationPaginationOptions = {}
  ): AsyncResult<{ submissions: LocationSubmissionDTO[]; total: number }> {
    try {
      const { page = 1, limit = 20 } = pagination;
      const offset = (page - 1) * limit;

      const where = filters.status ? eq(locationSubmissions.status, filters.status) : undefined;

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(locationSubmissions)
          .where(where)
          .orderBy(desc(locationSubmissions.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(locationSubmissions).where(where),
      ]);

      return {
        success: true,
        data: {
          submissions: rows.map((r) => this.rowToSubmissionDTO(r)),
          total: totalResult[0]?.total ?? 0,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getSubmission(id: string): AsyncResult<LocationSubmissionDTO | null> {
    try {
      const rows = await db
        .select()
        .from(locationSubmissions)
        .where(eq(locationSubmissions.id, id))
        .limit(1);
      if (!rows.length) return { success: true, data: null };
      return { success: true, data: this.rowToSubmissionDTO(rows[0]) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async approveSubmission(id: string, adminId: string): AsyncResult<LocationDTO> {
    try {
      const subRows = await db
        .select()
        .from(locationSubmissions)
        .where(eq(locationSubmissions.id, id))
        .limit(1);

      if (!subRows.length) return { success: false, error: 'Submission not found' };
      const sub = subRows[0];

      // Create the location from submission data
      const createResult = await this.createLocation({
        category: 'store',
        name: sub.storeName,
        addressLine1: sub.storeAddressLine1,
        addressCity: sub.storeAddressCity,
        addressState: sub.storeAddressState,
        addressPostalCode: sub.storeAddressPostalCode,
        addressCountry: sub.storeAddressCountry,
        contactPhone: sub.storeContactPhone ?? undefined,
        contactEmail: sub.storeContactEmail ?? undefined,
        contactWebsite: sub.storeContactWebsite ?? undefined,
        managerName: sub.storeManagerName ?? undefined,
        managerEmail: sub.storeManagerEmail ?? undefined,
        managerPhone: sub.storeManagerPhone ?? undefined,
        tcgplayerStorefrontUrl: sub.tcgplayerStorefrontUrl ?? undefined,
        discordInviteUrl: sub.discordInviteUrl ?? undefined,
        notes: sub.notes ?? undefined,
      });

      if (!createResult.success) return createResult;

      // Mark submission approved
      await db
        .update(locationSubmissions)
        .set({ status: 'approved', approvedBy: adminId, approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(locationSubmissions.id, id));

      return createResult;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async rejectSubmission(id: string, adminId: string, reason: string): AsyncResult<boolean> {
    try {
      await db
        .update(locationSubmissions)
        .set({
          status: 'rejected',
          rejectedBy: adminId,
          rejectedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(locationSubmissions.id, id));
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private rowToSubmissionDTO(row: any): LocationSubmissionDTO {
    return {
      id: row.id,
      submitterName: row.submitterName,
      submittedByUserId: row.submittedByUserId,
      submitterPhone: row.submitterPhone,
      submitterRelationship: row.submitterRelationship,
      storeName: row.storeName,
      storeAddressLine1: row.storeAddressLine1,
      storeAddressCity: row.storeAddressCity,
      storeAddressState: row.storeAddressState,
      storeAddressPostalCode: row.storeAddressPostalCode,
      storeAddressCountry: row.storeAddressCountry,
      storeContactPhone: row.storeContactPhone,
      storeContactEmail: row.storeContactEmail,
      storeContactWebsite: row.storeContactWebsite,
      storeManagerName: row.storeManagerName,
      storeManagerEmail: row.storeManagerEmail,
      storeManagerPhone: row.storeManagerPhone,
      tcgplayerStorefrontUrl: row.tcgplayerStorefrontUrl,
      discordInviteUrl: row.discordInviteUrl,
      notes: row.notes,
      status: row.status,
      adminNotes: row.adminNotes,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      rejectedBy: row.rejectedBy,
      rejectedAt: row.rejectedAt,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
