/**
 * Locations Client Service
 * Client-side API abstraction for stores, events, and geo operations.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';
import type {
  LocationDTO,
  LocationSummaryDTO,
  LocationFollowerDTO,
  LocationManagerDTO,
  LocationSubmissionDTO,
  CountryDTO,
  StateDTO,
  StoresContextDTO,
  EventDTO,
  EventSummaryDTO,
  EventAttendeeDTO,
  BrowseLocationFilters,
  LocationPaginationOptions,
  CreateLocationDTO,
  UpdateLocationDTO,
  CreateEventDTO,
  UpdateEventDTO,
  CreateSubmissionDTO,
} from '@/types/location';

// ============================================================================
// Geo
// ============================================================================

export async function getCountries(): Promise<ApiResponse<CountryDTO[]>> {
  try {
    const res = await fetch('/api/geo');
    return handleResponse<CountryDTO[]>(res);
  } catch (e) { return handleError(e); }
}

export async function getStates(countryCode: string): Promise<ApiResponse<StateDTO[]>> {
  try {
    const res = await fetch(`/api/geo?countryCode=${encodeURIComponent(countryCode)}`);
    return handleResponse<StateDTO[]>(res);
  } catch (e) { return handleError(e); }
}

// ============================================================================
// Browse & Lookup
// ============================================================================

export async function browseLocations(
  filters: BrowseLocationFilters = {},
  pagination: LocationPaginationOptions = {}
): Promise<ApiResponse<{ locations: LocationSummaryDTO[]; total: number }>> {
  try {
    const params = buildQueryParams({ ...filters, ...pagination });
    const res = await fetch(`/api/locations?${params}`);
    return handleResponse(res);
  } catch (e) { return handleError(e); }
}

export async function getLocation(id: string): Promise<ApiResponse<LocationDTO>> {
  try {
    const res = await fetch(`/api/locations/${id}`);
    return handleResponse<LocationDTO>(res);
  } catch (e) { return handleError(e); }
}

// ============================================================================
// Follows
// ============================================================================

export async function followLocation(locationId: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch('/api/locations/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, action: 'follow' }),
    });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

export async function unfollowLocation(locationId: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch('/api/locations/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, action: 'unfollow' }),
    });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

export async function getStoresContext(): Promise<ApiResponse<StoresContextDTO>> {
  try {
    const res = await fetch('/api/users/me/stores-context');
    return handleResponse<StoresContextDTO>(res);
  } catch (e) { return handleError(e); }
}

// ============================================================================
// Store detail sub-resources
// ============================================================================

export async function getStoreEvents(
  locationId: string,
  includeEnded = false
): Promise<ApiResponse<EventDTO[]>> {
  try {
    const params = buildQueryParams({ includeEnded });
    const res = await fetch(`/api/stores/${locationId}/events?${params}`);
    return handleResponse<EventDTO[]>(res);
  } catch (e) { return handleError(e); }
}

export async function getStoreFollowers(
  locationId: string,
  pagination: LocationPaginationOptions = {}
): Promise<ApiResponse<{ followers: LocationFollowerDTO[]; total: number }>> {
  try {
    const params = buildQueryParams(pagination);
    const res = await fetch(`/api/stores/${locationId}/followers?${params}`);
    return handleResponse(res);
  } catch (e) { return handleError(e); }
}

export async function getStoreManagers(locationId: string): Promise<ApiResponse<LocationManagerDTO[]>> {
  try {
    const res = await fetch(`/api/stores/${locationId}/managers`);
    return handleResponse<LocationManagerDTO[]>(res);
  } catch (e) { return handleError(e); }
}

export async function canManageStore(locationId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/stores/${locationId}/can-manage`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.canManage === true;
  } catch { return false; }
}

// ============================================================================
// Events
// ============================================================================

export async function getUpcomingEvents(
  filters: { locationId?: string; type?: string; country?: string } = {},
  pagination: LocationPaginationOptions = {}
): Promise<ApiResponse<{ events: EventSummaryDTO[]; total: number }>> {
  try {
    const params = buildQueryParams({ ...filters, ...pagination });
    const res = await fetch(`/api/events/upcoming?${params}`);
    return handleResponse(res);
  } catch (e) { return handleError(e); }
}

export async function getEvent(id: string): Promise<ApiResponse<EventDTO>> {
  try {
    const res = await fetch(`/api/events/${id}`);
    return handleResponse<EventDTO>(res);
  } catch (e) { return handleError(e); }
}

export async function attendEvent(eventId: string, bringingTrades = true): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/events/${eventId}/attend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bringingTrades }),
    });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

export async function cancelAttendance(eventId: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/events/${eventId}/attend`, { method: 'DELETE' });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

export async function getEventAttendees(eventId: string): Promise<ApiResponse<EventAttendeeDTO[]>> {
  try {
    const res = await fetch(`/api/events/${eventId}/attendees`);
    return handleResponse<EventAttendeeDTO[]>(res);
  } catch (e) { return handleError(e); }
}

export async function createEvent(locationId: string, data: Omit<CreateEventDTO, 'locationId'>): Promise<ApiResponse<EventDTO>> {
  try {
    const res = await fetch(`/api/stores/${locationId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<EventDTO>(res);
  } catch (e) { return handleError(e); }
}

export async function updateEvent(eventId: string, data: UpdateEventDTO): Promise<ApiResponse<EventDTO>> {
  try {
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<EventDTO>(res);
  } catch (e) { return handleError(e); }
}

export async function deleteEvent(eventId: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

// ============================================================================
// Submissions
// ============================================================================

export async function createSubmission(data: CreateSubmissionDTO): Promise<ApiResponse<LocationSubmissionDTO>> {
  try {
    const res = await fetch('/api/location-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<LocationSubmissionDTO>(res);
  } catch (e) { return handleError(e); }
}

// ============================================================================
// Admin
// ============================================================================

export async function adminCreateLocation(data: CreateLocationDTO): Promise<ApiResponse<LocationDTO>> {
  try {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<LocationDTO>(res);
  } catch (e) { return handleError(e); }
}

export async function adminUpdateLocation(id: string, data: UpdateLocationDTO): Promise<ApiResponse<LocationDTO>> {
  try {
    const res = await fetch(`/api/locations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<LocationDTO>(res);
  } catch (e) { return handleError(e); }
}

export async function adminDeleteLocation(id: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

export async function adminListSubmissions(
  status?: string,
  pagination: LocationPaginationOptions = {}
): Promise<ApiResponse<{ submissions: LocationSubmissionDTO[]; total: number }>> {
  try {
    const params = buildQueryParams({ status, ...pagination });
    const res = await fetch(`/api/location-submissions?${params}`);
    return handleResponse(res);
  } catch (e) { return handleError(e); }
}

export async function adminReviewSubmission(
  id: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<ApiResponse<LocationDTO | boolean>> {
  try {
    const res = await fetch(`/api/location-submissions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    return handleResponse(res);
  } catch (e) { return handleError(e); }
}

export async function addManager(locationId: string, userId: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/stores/${locationId}/managers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}

export async function removeManager(locationId: string, userId: string): Promise<ApiResponse<boolean>> {
  try {
    const res = await fetch(`/api/stores/${locationId}/managers?userId=${userId}`, { method: 'DELETE' });
    return handleResponse<boolean>(res);
  } catch (e) { return handleError(e); }
}
