import type { AsyncResult } from './common';

export type VariantType = 'budget' | 'mid' | 'premium';

export interface CuratedListCardDTO {
  id: string;
  listId: string;
  printingId: string;
  cardUniqueId?: string;
  sortOrder: number;
  displayName?: string;
  imageUrl?: string;
  setCode?: string;
  collectorNumber?: string;
  color?: string;
  rarity?: string;
  foiling?: string;
  edition?: string;
  types?: string[];
  keywords?: string[];
  typeTextDisplay?: string;
  tcgLow?: number;
  tcgMarket?: number;
  tcgMid?: number;
  tcgHigh?: number;
  tcgplayerUrl?: string;
  isExtendedArt?: boolean;
  artVariations?: string[];
  foilInsetTop?: number;
  foilInsetRight?: number;
  foilInsetBottom?: number;
  foilInsetLeft?: number;
  foilInsetRound?: string;
  comment?: string | null;
}

export interface CuratorAttributionDTO {
  userId: string;
  username: string;
  displayUsername: string;
  avatarUrl: string | null;
  metafyProductUrl: string | null;
}

export interface CuratedListDTO {
  id: string;
  name: string;
  description: string | null;
  heroName: string | null;
  className: string | null;
  format: string | null;
  tags: string[];
  isPublished: boolean;
  sortOrder: number;
  parentId: string | null;
  variantType: VariantType | null;
  createdBy: string | null;
  curatorUser: CuratorAttributionDTO | null;
  createdAt: Date;
  updatedAt: Date;
  cards?: CuratedListCardDTO[];
  cardCount?: number;
  children?: CuratedListDTO[];
}

export interface CreateCuratedListInput {
  name: string;
  description?: string;
  heroName?: string;
  className?: string;
  format?: string;
  tags?: string[];
  sortOrder?: number;
  parentId?: string;
  variantType?: VariantType;
}

export interface UpdateCuratedListInput {
  name?: string;
  description?: string;
  heroName?: string;
  className?: string | null;
  format?: string;
  tags?: string[];
  isPublished?: boolean;
  sortOrder?: number;
  parentId?: string | null;
  variantType?: VariantType | null;
}

export interface ICuratedListService {
  getPublishedListsForHero(heroName?: string): AsyncResult<CuratedListDTO[]>;
  getAllPublished(options?: { includeCards?: boolean }): AsyncResult<CuratedListDTO[]>;
  getAllLists(): AsyncResult<CuratedListDTO[]>;
  getListsForCurator(userId: string): AsyncResult<CuratedListDTO[]>;
  getListById(id: string): AsyncResult<CuratedListDTO>;
  createList(userId: string, input: CreateCuratedListInput): AsyncResult<CuratedListDTO>;
  updateList(id: string, input: UpdateCuratedListInput): AsyncResult<CuratedListDTO>;
  deleteList(id: string): AsyncResult<void>;
  addCard(listId: string, printingId: string): AsyncResult<CuratedListCardDTO>;
  removeCard(cardId: string): AsyncResult<void>;
  reorderCards(listId: string, cardIds: string[]): AsyncResult<void>;
  updateCardComment(listId: string, cardName: string, comment: string | null): AsyncResult<void>;
}
