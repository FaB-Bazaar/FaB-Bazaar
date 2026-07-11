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

  /** Delete a tag definition — fails if it is assigned to any card. */
  deleteTagDefinition(id: string): AsyncResult<{ deleted: true }>;

  /** Add one tag to a card (and all same-name pitch variants); re-projects facet_tags. */
  addCardFacetTag(cardUniqueId: string, tag: string): AsyncResult<{ applied: number }>;

  /** Remove one tag from a card (and all same-name pitch variants); re-projects facet_tags. */
  removeCardFacetTag(cardUniqueId: string, tag: string): AsyncResult<{ applied: number }>;

  /** Set (or clear with null) curated strategy prose for ONE card variant — no same-name fan-out. */
  setStrategyNotes(cardUniqueId: string, notes: string | null): AsyncResult<{ updated: true }>;

  /** Read curated strategy prose for one card variant (null when unset). */
  getStrategyNotes(cardUniqueId: string): AsyncResult<{ notes: string | null }>;
}
