import type { AsyncResult } from './common';
import type {
  EventDTO,
  EventSummaryDTO,
  EventAttendeeDTO,
  CreateEventDTO,
  UpdateEventDTO,
  LocationPaginationOptions,
} from '@/types/location';

export interface UpcomingEventsFilters {
  locationId?: string;
  type?: string;
  country?: string;
}

export interface IEventService {
  // ====================================
  // Lookup
  // ====================================

  getEventById(id: string): AsyncResult<EventDTO | null>;

  getEventsAtLocation(
    locationId: string,
    options?: { includeEnded?: boolean }
  ): AsyncResult<EventDTO[]>;

  getUpcomingEvents(
    filters?: UpcomingEventsFilters,
    pagination?: LocationPaginationOptions
  ): AsyncResult<{ events: EventSummaryDTO[]; total: number }>;

  // ====================================
  // Attendance
  // ====================================

  attendEvent(eventId: string, userId: string, bringingTrades?: boolean): AsyncResult<boolean>;

  cancelAttendance(eventId: string, userId: string): AsyncResult<boolean>;

  getEventAttendees(eventId: string): AsyncResult<EventAttendeeDTO[]>;

  getUserUpcomingEvents(userId: string): AsyncResult<EventDTO[]>;

  isAttending(eventId: string, userId: string): AsyncResult<boolean>;

  // ====================================
  // Admin CRUD
  // ====================================

  createEvent(data: CreateEventDTO, createdBy?: string): AsyncResult<EventDTO>;

  updateEvent(id: string, data: UpdateEventDTO): AsyncResult<EventDTO>;

  deleteEvent(id: string): AsyncResult<boolean>;
}
