import type { AsyncResult } from './common'

export type BannedFormat =
  | 'silver_age'
  | 'classic_constructed'
  | 'living_legend'
  | 'blitz'
  | 'commoner'
  | 'clash'
  | 'ultimate_pit_fight'
  | 'draft'
  | 'sealed'
  | 'open'

export const BANNED_FORMATS: readonly BannedFormat[] = [
  'silver_age',
  'classic_constructed',
  'living_legend',
  'blitz',
  'commoner',
  'clash',
  'ultimate_pit_fight',
  'draft',
  'sealed',
  'open',
] as const

export interface BannedCardDTO {
  id: string
  cardUniqueId: string
  format: BannedFormat
  sourceUniqueId: string | null
  statusActive: boolean
  dateAnnounced: string | null
  dateInEffect: string | null
  legalityArticle: string | null
  createdAt: string
  updatedAt: string
}

export interface BannedCardUpsertInput {
  cardUniqueId: string
  format: BannedFormat
  sourceUniqueId?: string | null
  statusActive?: boolean
  dateAnnounced?: string | null
  dateInEffect?: string | null
  legalityArticle?: string | null
}

export interface BannedCardSyncResult {
  format: BannedFormat
  added: number
  updated: number
  deactivated: number
  unchanged: number
}

export interface IBannedCardsService {
  /** List entries for a format (active only by default). */
  listByFormat(format: BannedFormat, opts?: { includeInactive?: boolean }): AsyncResult<BannedCardDTO[]>

  /** Fast check used by validators. Returns true iff the card is in an active ban for the format. */
  isBanned(cardUniqueId: string, format: BannedFormat): AsyncResult<boolean>

  /** Upsert by (cardUniqueId, format). */
  upsert(input: BannedCardUpsertInput): AsyncResult<BannedCardDTO>

  /** Toggle status_active (soft-delete preserves history). */
  setActive(id: string, active: boolean): AsyncResult<BannedCardDTO>

  /** Hard-delete a single row by id. Prefer setActive for history. */
  deleteById(id: string): AsyncResult<void>

  /**
   * Bulk upsert from a FaB-cube banned JSON array. Entries with the same
   * (cardUniqueId, format) are updated; entries missing from the payload that
   * are currently active get deactivated (treated as unbanned upstream).
   */
  syncFromUpstream(
    format: BannedFormat,
    entries: Array<{
      card_unique_id: string
      unique_id?: string
      status_active?: boolean
      date_announced?: string | null
      date_in_effect?: string | null
      legality_article?: string | null
    }>,
  ): AsyncResult<BannedCardSyncResult>
}
