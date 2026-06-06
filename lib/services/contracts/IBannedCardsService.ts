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

// FaB's full legality taxonomy (see card-legality-policy):
//   banned        — permanent, per-format
//   restricted    — Living Legend 1-of
//   benched       — Silver Age heroes, time-boxed (auto-return at season end)
//   living_legend — adult hero + signature weapon pseudo-ban (graduated out of CC)
export type RestrictionType = 'banned' | 'restricted' | 'benched' | 'living_legend'

export const RESTRICTION_TYPES: readonly RestrictionType[] = ['banned', 'restricted', 'benched', 'living_legend'] as const

/** Why a hero was benched in Silver Age. */
export type BenchReason = 'lss_pick' | 'community_vote'

export interface BannedCardDTO {
  id: string
  cardUniqueId: string
  format: BannedFormat
  restrictionType: RestrictionType
  sourceUniqueId: string | null
  statusActive: boolean
  dateAnnounced: string | null
  dateInEffect: string | null
  /** Benching "until" — when a benched hero auto-returns. NULL for other statuses. */
  dateExpires: string | null
  /** Human "until Set 20" label for a benched window. NULL for other statuses. */
  untilSet: string | null
  /** Why a hero was benched ('lss_pick' | 'community_vote'). NULL for other statuses. */
  reason: BenchReason | null
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
  dateExpires?: string | null
  untilSet?: string | null
  reason?: BenchReason | null
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
