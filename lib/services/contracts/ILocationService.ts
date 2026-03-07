import type { AsyncResult } from './common';
import type {
  LocationDTO,
  LocationSummaryDTO,
  LocationFollowerDTO,
  LocationManagerDTO,
  LocationSubmissionDTO,
  CountryDTO,
  StateDTO,
  StoresContextDTO,
  BrowseLocationFilters,
  LocationPaginationOptions,
  CreateLocationDTO,
  UpdateLocationDTO,
  CreateSubmissionDTO,
  BrowseSubmissionsFilters,
} from '@/types/location';

export interface ILocationService {
  // ====================================
  // Browse & Lookup
  // ====================================

  getLocationById(id: string): AsyncResult<LocationDTO | null>;

  browseLocations(
    filters: BrowseLocationFilters,
    pagination?: LocationPaginationOptions
  ): AsyncResult<{ locations: LocationSummaryDTO[]; total: number }>;

  // ====================================
  // Follows
  // ====================================

  followLocation(userId: string, locationId: string): AsyncResult<boolean>;

  unfollowLocation(userId: string, locationId: string): AsyncResult<boolean>;

  getUserFollowedStores(userId: string): AsyncResult<LocationSummaryDTO[]>;

  getLocationFollowers(
    locationId: string,
    pagination?: LocationPaginationOptions
  ): AsyncResult<{ followers: LocationFollowerDTO[]; total: number }>;

  isFollowing(userId: string, locationId: string): AsyncResult<boolean>;

  // ====================================
  // Stores Context (trade matching / profile)
  // ====================================

  getUserStoresContext(userId: string): AsyncResult<StoresContextDTO>;

  // ====================================
  // Nearby Users (trade matching helper)
  // ====================================

  /** Returns user IDs reachable via followed stores or active event attendance */
  getNearbyUsers(userId: string): AsyncResult<string[]>;

  // ====================================
  // Managers
  // ====================================

  getLocationManagers(locationId: string): AsyncResult<LocationManagerDTO[]>;

  addManager(locationId: string, userId: string): AsyncResult<boolean>;

  removeManager(locationId: string, userId: string): AsyncResult<boolean>;

  canManageLocation(userId: string, locationId: string): AsyncResult<boolean>;

  // ====================================
  // Admin CRUD
  // ====================================

  createLocation(data: CreateLocationDTO): AsyncResult<LocationDTO>;

  updateLocation(id: string, data: UpdateLocationDTO): AsyncResult<LocationDTO>;

  deleteLocation(id: string): AsyncResult<boolean>;

  // ====================================
  // Geo
  // ====================================

  getCountries(): AsyncResult<CountryDTO[]>;

  getStates(countryIso2: string): AsyncResult<StateDTO[]>;

  // ====================================
  // Submissions
  // ====================================

  createSubmission(data: CreateSubmissionDTO): AsyncResult<LocationSubmissionDTO>;

  listSubmissions(
    filters?: BrowseSubmissionsFilters,
    pagination?: LocationPaginationOptions
  ): AsyncResult<{ submissions: LocationSubmissionDTO[]; total: number }>;

  getSubmission(id: string): AsyncResult<LocationSubmissionDTO | null>;

  approveSubmission(id: string, adminId: string): AsyncResult<LocationDTO>;

  rejectSubmission(id: string, adminId: string, reason: string): AsyncResult<boolean>;
}
