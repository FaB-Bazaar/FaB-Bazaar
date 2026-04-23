import type { AsyncResult } from './common';

export interface CustomTokenCardCreatorDTO {
  id: string;
  // NOTE: `userId` is intentionally NOT exposed on this DTO — prevents public
  // endpoints from leaking creator-slug → user-id mappings. Routes that need
  // to resolve the caller's userId should read it from the auth session.
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;

  websiteUrl: string | null;
  shopUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  blueskyUrl: string | null;
  discordInviteUrl: string | null;

  createdAt: Date;
  updatedAt: Date;

  tokenCardCount?: number;
}

/** Metadata pulled from the `cards` table when a custom token card links to an official card. */
export interface LinkedCardMetadataDTO {
  cardUniqueId: string;
  displayName: string | null;
  types: string[] | null;
  color: string | null;
  typeTextDisplay: string | null;
}

export interface CustomTokenCardDTO {
  id: string;
  creatorId: string;
  cardUniqueId: string | null;
  externalId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  purchaseUrl: string | null;
  inStock: boolean | null;
  stockUpdatedAt: Date | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Hydrated on read
  linkedCard?: LinkedCardMetadataDTO | null;
  creator?: Pick<CustomTokenCardCreatorDTO, 'id' | 'displayName' | 'slug' | 'avatarUrl' | 'isVerified'>;
}

export interface CreateCreatorProfileInput {
  displayName: string;
  slug?: string; // auto-generated from displayName if omitted
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  shopUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  xUrl?: string;
  blueskyUrl?: string;
  discordInviteUrl?: string;
}

export type UpdateCreatorProfileInput = Partial<CreateCreatorProfileInput>;

export interface CreateCustomTokenCardInput {
  cardUniqueId?: string | null;
  externalId?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  purchaseUrl?: string | null;
  inStock?: boolean | null;
  isPublished?: boolean;
}

export type UpdateCustomTokenCardInput = Partial<CreateCustomTokenCardInput>;

export interface ICustomTokenCardService {
  // Creator profile reads
  getCreatorByUserId(userId: string): AsyncResult<CustomTokenCardCreatorDTO | null>;
  getCreatorBySlug(slug: string): AsyncResult<CustomTokenCardCreatorDTO | null>;
  listCreators(): AsyncResult<CustomTokenCardCreatorDTO[]>;

  // Creator profile mutations (caller must be the owning user; role gate at route layer)
  createCreatorProfile(userId: string, input: CreateCreatorProfileInput): AsyncResult<CustomTokenCardCreatorDTO>;
  updateCreatorProfile(creatorId: string, input: UpdateCreatorProfileInput): AsyncResult<CustomTokenCardCreatorDTO>;

  // Token card reads
  getTokenCardById(tokenCardId: string): AsyncResult<CustomTokenCardDTO | null>;
  getPublishedTokenCardsByCreator(creatorId: string): AsyncResult<CustomTokenCardDTO[]>;
  listTokenCardsByCreator(creatorId: string): AsyncResult<CustomTokenCardDTO[]>; // includes drafts, for portal

  // Token card mutations (ownership verified inside: creatorId must match existing row)
  createTokenCard(creatorId: string, input: CreateCustomTokenCardInput): AsyncResult<CustomTokenCardDTO>;
  updateTokenCard(creatorId: string, tokenCardId: string, input: UpdateCustomTokenCardInput): AsyncResult<CustomTokenCardDTO>;
  deleteTokenCard(creatorId: string, tokenCardId: string): AsyncResult<void>;
}
