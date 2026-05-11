/**
 * Map service-layer Result `code` strings to HTTP status codes.
 *
 * Services return `{ success: false, error, code? }` from
 * `lib/services/contracts/common.ts`. Each route turned that into a
 * status code via a repeated ternary ladder
 * (`code === 'forbidden' ? 403 : code === 'not_found' ? 404 : 400`).
 * One helper keeps the mapping centralized and easy to extend.
 *
 * Callers pass `fallback` to choose between 400 (validation-style
 * failures on mutation endpoints) and 500 (unexpected failures on
 * read endpoints).
 */
const CODE_TO_STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  slug_taken: 409,
};

export function statusFor(code: string | undefined, fallback = 400): number {
  return code ? (CODE_TO_STATUS[code] ?? fallback) : fallback;
}
