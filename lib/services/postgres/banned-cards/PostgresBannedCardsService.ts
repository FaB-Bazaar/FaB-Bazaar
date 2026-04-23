import { db } from '@/lib/postgres/db'
import { bannedCards } from '@/lib/postgres/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type {
  BannedCardDTO,
  BannedCardSyncResult,
  BannedCardUpsertInput,
  BannedFormat,
  IBannedCardsService,
} from '../../contracts/IBannedCardsService'
import type { AsyncResult } from '../../contracts/common'

type BannedCardRow = typeof bannedCards.$inferSelect

function toDTO(row: BannedCardRow): BannedCardDTO {
  return {
    id: row.id,
    cardUniqueId: row.cardUniqueId,
    format: row.format as BannedFormat,
    sourceUniqueId: row.sourceUniqueId ?? null,
    statusActive: row.statusActive,
    dateAnnounced: row.dateAnnounced ? row.dateAnnounced.toISOString() : null,
    dateInEffect: row.dateInEffect ? row.dateInEffect.toISOString() : null,
    legalityArticle: row.legalityArticle ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export class PostgresBannedCardsService implements IBannedCardsService {
  async listByFormat(
    format: BannedFormat,
    opts?: { includeInactive?: boolean },
  ): AsyncResult<BannedCardDTO[]> {
    try {
      const where = opts?.includeInactive
        ? eq(bannedCards.format, format)
        : and(eq(bannedCards.format, format), eq(bannedCards.statusActive, true))!

      const rows = await db
        .select()
        .from(bannedCards)
        .where(where)
        .orderBy(bannedCards.cardUniqueId)

      return { success: true, data: rows.map(toDTO) }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list banned cards' }
    }
  }

  async isBanned(cardUniqueId: string, format: BannedFormat): AsyncResult<boolean> {
    try {
      const rows = await db
        .select({ id: bannedCards.id })
        .from(bannedCards)
        .where(
          and(
            eq(bannedCards.cardUniqueId, cardUniqueId),
            eq(bannedCards.format, format),
            eq(bannedCards.statusActive, true),
          ),
        )
        .limit(1)
      return { success: true, data: rows.length > 0 }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to check ban status' }
    }
  }

  async upsert(input: BannedCardUpsertInput): AsyncResult<BannedCardDTO> {
    try {
      const now = new Date()
      const row = await db
        .insert(bannedCards)
        .values({
          id: nanoid(),
          cardUniqueId: input.cardUniqueId,
          format: input.format,
          sourceUniqueId: input.sourceUniqueId ?? null,
          statusActive: input.statusActive ?? true,
          dateAnnounced: toDate(input.dateAnnounced),
          dateInEffect: toDate(input.dateInEffect),
          legalityArticle: input.legalityArticle ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [bannedCards.cardUniqueId, bannedCards.format],
          set: {
            sourceUniqueId: input.sourceUniqueId ?? null,
            statusActive: input.statusActive ?? true,
            dateAnnounced: toDate(input.dateAnnounced),
            dateInEffect: toDate(input.dateInEffect),
            legalityArticle: input.legalityArticle ?? null,
            updatedAt: now,
          },
        })
        .returning()

      if (!row[0]) {
        return { success: false, error: 'Upsert returned no row' }
      }
      return { success: true, data: toDTO(row[0]) }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to upsert banned card' }
    }
  }

  async setActive(id: string, active: boolean): AsyncResult<BannedCardDTO> {
    try {
      const row = await db
        .update(bannedCards)
        .set({ statusActive: active, updatedAt: new Date() })
        .where(eq(bannedCards.id, id))
        .returning()
      if (!row[0]) return { success: false, error: 'Banned card not found' }
      return { success: true, data: toDTO(row[0]) }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update ban status' }
    }
  }

  async deleteById(id: string): AsyncResult<void> {
    try {
      await db.delete(bannedCards).where(eq(bannedCards.id, id))
      return { success: true, data: undefined }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete banned card' }
    }
  }

  async syncFromUpstream(
    format: BannedFormat,
    entries: Array<{
      card_unique_id: string
      unique_id?: string
      status_active?: boolean
      date_announced?: string | null
      date_in_effect?: string | null
      legality_article?: string | null
    }>,
  ): AsyncResult<BannedCardSyncResult> {
    try {
      const now = new Date()
      const existingRows = await db
        .select()
        .from(bannedCards)
        .where(eq(bannedCards.format, format))

      const existingByCard = new Map(existingRows.map(r => [r.cardUniqueId, r]))

      // Upstream JSON can contain multiple historical rows per card_unique_id
      // (ban / unban / re-ban over time). Keep the latest one by date_in_effect
      // (falling back to array order, which is chronological in FaB-cube JSON).
      const latestByCard = new Map<string, typeof entries[number]>()
      for (const e of entries) {
        const current = latestByCard.get(e.card_unique_id)
        if (!current) {
          latestByCard.set(e.card_unique_id, e)
          continue
        }
        const a = e.date_in_effect ? Date.parse(e.date_in_effect) : 0
        const b = current.date_in_effect ? Date.parse(current.date_in_effect) : 0
        if (a >= b) latestByCard.set(e.card_unique_id, e)
      }
      const deduped = Array.from(latestByCard.values())
      const upstreamIds = new Set(deduped.map(e => e.card_unique_id))

      let added = 0
      let updated = 0
      let unchanged = 0
      let deactivated = 0

      for (const entry of deduped) {
        const statusActive = entry.status_active ?? true
        const existing = existingByCard.get(entry.card_unique_id)
        if (!existing) {
          await db.insert(bannedCards).values({
            id: nanoid(),
            cardUniqueId: entry.card_unique_id,
            format,
            sourceUniqueId: entry.unique_id ?? null,
            statusActive,
            dateAnnounced: toDate(entry.date_announced),
            dateInEffect: toDate(entry.date_in_effect),
            legalityArticle: entry.legality_article ?? null,
            updatedAt: now,
          })
          added++
        } else {
          const needsUpdate =
            existing.statusActive !== statusActive ||
            existing.sourceUniqueId !== (entry.unique_id ?? null) ||
            (existing.dateAnnounced?.toISOString() ?? null) !== (entry.date_announced ?? null) ||
            (existing.dateInEffect?.toISOString() ?? null) !== (entry.date_in_effect ?? null) ||
            existing.legalityArticle !== (entry.legality_article ?? null)
          if (needsUpdate) {
            await db
              .update(bannedCards)
              .set({
                statusActive,
                sourceUniqueId: entry.unique_id ?? null,
                dateAnnounced: toDate(entry.date_announced),
                dateInEffect: toDate(entry.date_in_effect),
                legalityArticle: entry.legality_article ?? null,
                updatedAt: now,
              })
              .where(eq(bannedCards.id, existing.id))
            updated++
          } else {
            unchanged++
          }
        }
      }

      // Deactivate rows that were active locally but missing upstream
      const stale = existingRows.filter(r => r.statusActive && !upstreamIds.has(r.cardUniqueId))
      if (stale.length > 0) {
        await db
          .update(bannedCards)
          .set({ statusActive: false, updatedAt: now })
          .where(inArray(bannedCards.id, stale.map(r => r.id)))
        deactivated = stale.length
      }

      return {
        success: true,
        data: { format, added, updated, deactivated, unchanged },
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to sync banned cards' }
    }
  }
}
