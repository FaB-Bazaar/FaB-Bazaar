// types/location.ts — replaces legacy types/store.ts

// ============================================================================
// ENUMS
// ============================================================================

export type LocationCategory = 'store' | 'venue';

export type EventType =
  | 'calling'
  | 'pro_tour'
  | 'national'
  | 'open'
  | 'store_champ'
  | 'other';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs_review';

export type SubmitterRelationship = 'owner' | 'manager' | 'employee' | 'customer' | 'other';

// ============================================================================
// GEO DTOs
// ============================================================================

export interface CountryDTO {
  id: number;
  name: string;
  iso2: string;
  iso3?: string | null;
  phoneCode?: string | null;
}

export interface StateDTO {
  id: number;
  name: string;
  stateCode: string;
  countryId: number;
}

// ============================================================================
// LOCATION DTOs
// ============================================================================

export interface LocationDTO {
  id: string;
  category: LocationCategory;
  name: string;

  addressLine1: string;
  addressCity: string;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry: string;
  addressCountryId?: number | null;
  addressStateId?: number | null;

  // Decrypted at read time
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;

  tcgplayerId?: string | null;
  googlePlaceId?: string | null;
  facebookId?: string | null;
  tcgplayerStorefrontUrl?: string | null;
  discordInviteUrl?: string | null;

  tags: string[];
  active: boolean;
  geoLat?: string | null;
  geoLng?: string | null;
  images: string[];

  // Decrypted at read time
  managerName?: string | null;
  managerEmail?: string | null;
  managerPhone?: string | null;

  notes?: string | null;
  followerCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface LocationSummaryDTO {
  id: string;
  category: LocationCategory;
  name: string;
  addressCity: string;
  addressState?: string | null;
  addressCountry: string;
  tags: string[];
  active: boolean;
  followerCount: number;
}

// ============================================================================
// EVENT DTOs
// ============================================================================

export interface EventDTO {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  type: EventType;
  format?: string | null;
  startDate: Date;
  endDate: Date;
  registrationUrl?: string | null;
  discordInviteUrl?: string | null;
  notes?: string | null;
  active: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSummaryDTO {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  type: EventType;
  format?: string | null;
  startDate: Date;
  endDate: Date;
  attendeeCount: number;
}

export interface EventAttendeeDTO {
  userId: string;
  username: string;
  displayUsername?: string | null;
  avatarUrl?: string | null;
  bringingTrades: boolean;
  createdAt: Date;
}

// ============================================================================
// FOLLOW / MANAGER DTOs
// ============================================================================

export interface LocationFollowerDTO {
  userId: string;
  username: string;
  displayUsername?: string | null;
  avatarUrl?: string | null;
  followedAt: Date;
}

export interface LocationManagerDTO {
  userId: string;
  username: string;
  displayUsername?: string | null;
  avatarUrl?: string | null;
  assignedAt: Date;
}

// ============================================================================
// SUBMISSION DTO
// ============================================================================

export interface LocationSubmissionDTO {
  id: string;

  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string | null;
  submitterRelationship: SubmitterRelationship;

  storeName: string;
  storeAddressLine1: string;
  storeAddressCity: string;
  storeAddressState: string;
  storeAddressPostalCode: string;
  storeAddressCountry: string;
  storeContactPhone?: string | null;
  storeContactEmail?: string | null;
  storeContactWebsite?: string | null;
  storeManagerName?: string | null;
  storeManagerEmail?: string | null;
  storeManagerPhone?: string | null;
  tcgplayerStorefrontUrl?: string | null;
  discordInviteUrl?: string | null;
  notes?: string | null;

  status: SubmissionStatus;
  adminNotes?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectedBy?: string | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// STORES CONTEXT DTO (for /api/users/me/stores-context)
// ============================================================================

export interface StoresContextDTO {
  countryCode?: string | null;
  followedStores: LocationSummaryDTO[];
  upcomingEvents: EventSummaryDTO[];
}

// ============================================================================
// FILTER / INPUT TYPES
// ============================================================================

export interface BrowseLocationFilters {
  country?: string;
  state?: string;
  search?: string;
  category?: LocationCategory;
  active?: boolean;
}

export interface LocationPaginationOptions {
  page?: number;
  limit?: number;
}

export interface CreateLocationDTO {
  category?: LocationCategory;
  name: string;
  addressLine1: string;
  addressCity: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry: string;
  addressCountryId?: number;
  addressStateId?: number;
  contactPhone?: string;
  contactEmail?: string;
  contactWebsite?: string;
  tcgplayerId?: string;
  googlePlaceId?: string;
  facebookId?: string;
  tcgplayerStorefrontUrl?: string;
  discordInviteUrl?: string;
  tags?: string[];
  active?: boolean;
  geoLat?: string;
  geoLng?: string;
  images?: string[];
  managerName?: string;
  managerEmail?: string;
  managerPhone?: string;
  notes?: string;
}

export interface UpdateLocationDTO {
  category?: LocationCategory;
  name?: string;
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  addressCountryId?: number;
  addressStateId?: number;
  contactPhone?: string;
  contactEmail?: string;
  contactWebsite?: string;
  tcgplayerId?: string;
  googlePlaceId?: string;
  facebookId?: string;
  tcgplayerStorefrontUrl?: string;
  discordInviteUrl?: string;
  tags?: string[];
  active?: boolean;
  geoLat?: string;
  geoLng?: string;
  images?: string[];
  managerName?: string;
  managerEmail?: string;
  managerPhone?: string;
  notes?: string;
}

export interface CreateEventDTO {
  locationId: string;
  name: string;
  type?: EventType;
  format?: string;
  startDate: Date;
  endDate: Date;
  registrationUrl?: string;
  discordInviteUrl?: string;
  notes?: string;
  active?: boolean;
}

export interface UpdateEventDTO {
  name?: string;
  type?: EventType;
  format?: string;
  startDate?: Date;
  endDate?: Date;
  registrationUrl?: string;
  discordInviteUrl?: string;
  notes?: string;
  active?: boolean;
}

export interface CreateSubmissionDTO {
  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string;
  submitterRelationship: SubmitterRelationship;
  storeName: string;
  storeAddressLine1: string;
  storeAddressCity: string;
  storeAddressState: string;
  storeAddressPostalCode: string;
  storeAddressCountry: string;
  storeContactPhone?: string;
  storeContactEmail?: string;
  storeContactWebsite?: string;
  storeManagerName?: string;
  storeManagerEmail?: string;
  storeManagerPhone?: string;
  tcgplayerStorefrontUrl?: string;
  discordInviteUrl?: string;
  notes?: string;
}

export interface BrowseSubmissionsFilters {
  status?: SubmissionStatus;
}
