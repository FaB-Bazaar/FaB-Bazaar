/**
 * URL state for /admin/user-access: `?q=` (username/email search) and `?page=`.
 * Pure — shared by the server page (reading) and the client (building links).
 */

/** Users per page. A multiple of 6 so the 1/2/3-column grid ends on a full row. */
export const USER_ACCESS_PAGE_SIZE = 24;

const MAX_SEARCH_LENGTH = 100;
const BASE_PATH = '/admin/user-access';

export interface UserAccessParams {
  page: number;
  searchTerm: string;
}

type RawParam = string | string[] | undefined;

function first(value: RawParam): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function parseUserAccessParams(raw: { page?: RawParam; q?: RawParam }): UserAccessParams {
  const pageText = first(raw.page);
  const page = /^[1-9]\d{0,8}$/.test(pageText) ? Number(pageText) : 1;
  const searchTerm = first(raw.q).trim().slice(0, MAX_SEARCH_LENGTH);
  return { page, searchTerm };
}

export function userAccessHref({ page, searchTerm }: UserAccessParams): string {
  const params = new URLSearchParams();
  if (searchTerm) params.set('q', searchTerm);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}
