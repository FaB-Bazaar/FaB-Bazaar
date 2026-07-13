import type { AsyncResult } from './common';

/** The three fixed facet dimensions. */
export type FacetDimension = 'mechanical' | 'strategic' | 'synergy';

export interface FacetTagDefinitionDTO {
  id: string;
  dim: FacetDimension;
  label: string;
  def: string;
  draft: boolean;
}

export interface FacetTagDefinitionWithCount extends FacetTagDefinitionDTO {
  /** Distinct card names this tag is assigned to (drives the rail + delete guard). */
  cardCount: number;
}

export interface CreateFacetTagInput {
  id: string;
  dim: FacetDimension;
  label: string;
  def?: string;
  draft?: boolean;
}

/**
 * Fields editable on an existing tag definition. The slug `id` is immutable —
 * it is the PK referenced by assignments, votes and the audit trail — so it is
 * addressed separately and never appears here. Omitted fields are left as-is.
 */
export interface UpdateFacetTagInput {
  dim?: FacetDimension;
  label?: string;
  def?: string;
  draft?: boolean;
}

/** A community-voted facet tag on a card, with its confidence count. */
export interface CardCommunityTag {
  tag: string;
  /** Distinct users who voted this tag onto the card. */
  votes: number;
  /** Whether the querying user is one of those voters. */
  votedByMe: boolean;
}

/** One tag on a card in the batch summary: community votes + whether it's live in search. */
export interface CardFacetSummaryTag {
  tag: string;
  /** Distinct community voters (0 for curator-only tags). */
  votes: number;
  /** True when the tag is in the cards.facet_tags projection (curator ∪ votes ≥ threshold). */
  live: boolean;
  /** True when the querying viewer voted this tag — live FOR THEM regardless of threshold. */
  mine: boolean;
}

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface FacetSuggestionDTO {
  id: string;
  proposedId: string | null;
  dim: FacetDimension;
  label: string;
  def: string;
  rationale: string;
  proposedBy: string;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface CreateSuggestionInput {
  proposedId?: string;
  dim: FacetDimension;
  label: string;
  def?: string;
  rationale?: string;
  proposedBy: string;
}

/** Curator overrides applied when approving a suggestion into a real tag. */
export interface ApproveSuggestionOverrides {
  id?: string;
  dim?: FacetDimension;
  label?: string;
  def?: string;
}

/**
 * Content-manager surface for the curated card-facet vocabulary and per-card
 * assignments. The vocabulary lives in `facet_tag_definitions`; assignments in
 * `card_facet_tags`; the searchable projection in `cards.facet_tags`. Curated
 * per-card strategy prose lives in `cards.strategy_notes`.
 *
 * Safety invariant: mutations only ever rewrite the curation-owned `cards`
 * columns (`facet_tags`, recomputed from `card_facet_tags`; `strategy_notes`)
 * — never any other `cards` column. Deleting a tag definition is blocked while
 * it is assigned (FK ON DELETE RESTRICT).
 *
 * Fan-out asymmetry (deliberate): tags apply to every same-name pitch variant;
 * strategy notes do NOT — red and blue of a card can play different roles, so
 * prose is per `card_unique_id`.
 */
export interface IFacetService {
  /** All tag definitions, ordered by dimension then label. */
  listTagDefinitions(): AsyncResult<FacetTagDefinitionDTO[]>;

  /** Tag definitions with per-tag usage counts (distinct card names). */
  getTagUsageCounts(): AsyncResult<FacetTagDefinitionWithCount[]>;

  /** Create a new tag definition. */
  createTagDefinition(input: CreateFacetTagInput): AsyncResult<FacetTagDefinitionDTO>;

  /**
   * Edit an existing tag definition's display fields (label/def/dim/draft). The
   * slug `id` is immutable; assignments keyed off it are untouched. Fails if no
   * tag with that id exists.
   */
  updateTagDefinition(id: string, input: UpdateFacetTagInput): AsyncResult<FacetTagDefinitionDTO>;

  /** Delete a tag definition — fails if it is assigned to any card. */
  deleteTagDefinition(id: string): AsyncResult<{ deleted: true }>;

  /** Add one tag to a card (and all same-name pitch variants) as a CURATOR — authoritative, always projected. */
  addCardFacetTag(cardUniqueId: string, tag: string): AsyncResult<{ applied: number }>;

  /** Remove a curator tag from a card (and all same-name pitch variants); re-projects facet_tags. */
  removeCardFacetTag(cardUniqueId: string, tag: string): AsyncResult<{ applied: number }>;

  /**
   * Cast the calling user's community vote for a tag on a card (fans out to all
   * same-name variants; idempotent per user). A community tag enters the
   * searchable projection only at >= 2 distinct voters. Logs an audit row.
   * Returns the resulting distinct-voter count and variants affected.
   */
  voteCardFacetTag(cardUniqueId: string, tag: string, userId: string): AsyncResult<{ votes: number; applied: number }>;

  /** Retract the calling user's community vote (fans out); re-projects; logs an audit row. */
  unvoteCardFacetTag(cardUniqueId: string, tag: string, userId: string): AsyncResult<{ votes: number; applied: number }>;

  /** Community-voted tags on a card with per-tag counts and whether `userId` voted each. */
  getCardCommunityTags(cardUniqueId: string, userId?: string): AsyncResult<CardCommunityTag[]>;

  /**
   * Batch read for result grids: per card, the union of live (projected) tags and
   * community-voted tags with vote counts. Cards with no tags are omitted.
   * `viewerId` marks the viewer's own votes (`mine`) for personal-truth display.
   */
  getFacetSummaryForCards(cardUniqueIds: string[], viewerId?: string): AsyncResult<Record<string, CardFacetSummaryTag[]>>;

  /** Record a user's proposal for a new vocabulary term (lands as 'pending'). */
  createSuggestion(input: CreateSuggestionInput): AsyncResult<FacetSuggestionDTO>;

  /** List suggestions, optionally filtered by status (newest first). */
  listSuggestions(status?: SuggestionStatus): AsyncResult<FacetSuggestionDTO[]>;

  /** Approve a pending suggestion — mints a facet_tag_definitions row and marks it approved. */
  approveSuggestion(id: string, reviewerId: string, overrides?: ApproveSuggestionOverrides): AsyncResult<FacetTagDefinitionDTO>;

  /** Reject a pending suggestion — marks it rejected; creates no definition. */
  rejectSuggestion(id: string, reviewerId: string): AsyncResult<{ rejected: true }>;

  /** Set (or clear with null) curated strategy prose for ONE card variant — no same-name fan-out. */
  setStrategyNotes(cardUniqueId: string, notes: string | null): AsyncResult<{ updated: true }>;

  /** Read curated strategy prose for one card variant (null when unset). */
  getStrategyNotes(cardUniqueId: string): AsyncResult<{ notes: string | null }>;
}
