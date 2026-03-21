import type { AsyncResult } from './common';

export type VariantType = 'budget' | 'mid' | 'premium';

export interface CuratedListCardDTO {
  id: string;
  listId: string;
  printingId: string;
  sortOrder: number;
  displayName?: string;
  imageUrl?: string;
  setCode?: string;
  color?: string;
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
  createdAt: Date;
  updatedAt: Date;
  cards?: CuratedListCardDTO[];
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
  getAllLists(): AsyncResult<CuratedListDTO[]>;
  getListById(id: string): AsyncResult<CuratedListDTO>;
  createList(userId: string, input: CreateCuratedListInput): AsyncResult<CuratedListDTO>;
  updateList(id: string, input: UpdateCuratedListInput): AsyncResult<CuratedListDTO>;
  deleteList(id: string): AsyncResult<void>;
  addCard(listId: string, printingId: string): AsyncResult<CuratedListCardDTO>;
  removeCard(cardId: string): AsyncResult<void>;
  reorderCards(listId: string, cardIds: string[]): AsyncResult<void>;
}
