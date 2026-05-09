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

export type RestrictionType = 'banned' | 'restricted'

export const RESTRICTION_TYPES: readonly RestrictionType[] = ['banned', 'restricted'] as const

export interface BannedCardDTO {
  id: string
  cardUniqueId: string
  format: BannedFormat
  restrictionType: RestrictionType
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
  restrictionType?: RestrictionType
  sourceUniqueId?: string | null
  statusActive?: boolean
  dateAnnounced?: string | null
  dateInEffect?: string | null
  legalityArticle?: string | null
}

export interface BannedCardSyncResult {
  format: BannedFormat
  restrictionType: RestrictionType
  added: number
  updated: number
  deactivated: number
  unchanged: number
}

export interface IBannedCardsService {
  /** List entries for a format (active only by default). Filter by restrictionType if given. */
  listByFormat(format: BannedFormat, opts?: { includeInactive?: boolean; restrictionType?: RestrictionType }): AsyncResult<BannedCardDTO[]>

  /** Fast check: is the card in an active ban (restriction_type='banned') for the format? */
  isBanned(cardUniqueId: string, format: BannedFormat): AsyncResult<boolean>

  /** Active banned hero card_unique_ids for a format (heroes only — non-hero bans excluded). */
  listBannedHeroIds(format: BannedFormat): AsyncResult<string[]>

  /** Fast check: is the card in an active restriction (restriction_type='restricted', 1-per-deck)? */
  isRestricted(cardUniqueId: string, format: BannedFormat): AsyncResult<boolean>

  /** Upsert by (cardUniqueId, format, restrictionType). */
  upsert(input: BannedCardUpsertInput): AsyncResult<BannedCardDTO>

  /** Toggle status_active (soft-delete preserves history). */
  setActive(id: string, active: boolean): AsyncResult<BannedCardDTO>

  /** Hard-delete a single row by id. Prefer setActive for history. */
  deleteById(id: string): AsyncResult<void>

  /**
   * Bulk upsert from a FaB-cube banned/restricted JSON array. Entries with the
   * same (cardUniqueId, format, restrictionType) are updated; entries missing
   * from the payload that are currently active get deactivated.
   */
  syncFromUpstream(
    format: BannedFormat,
    restrictionType: RestrictionType,
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
