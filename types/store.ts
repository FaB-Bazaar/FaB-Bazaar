// types/store.ts
export interface Location {
  _id: string;
  name: string;
  location_id: string;
  address: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postal_code?: string;
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  tags: string[];
  active: boolean;
  upcomingEventCount: number;
  images?: string[];
  follower_count?: number;
}