// Safely normalize a fetch Response into our API result shape ({ success, ... }).
//
// Callers used to do `await res.json()` directly, which throws an opaque
// "Unexpected token '<'" when the server returns HTML instead of JSON (a 404/500
// error page, a proxy/WAF error, or a route that isn't deployed yet). This reads
// the body once and falls back to a friendly, status-aware error instead.

export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

interface ResponseLike {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export async function readApiResult<T = unknown>(res: ResponseLike): Promise<ApiResult<T>> {
  let body = '';
  try {
    body = await res.text();
  } catch {
    return { success: false, error: `Request failed (HTTP ${res.status})` };
  }

  try {
    return JSON.parse(body) as ApiResult<T>;
  } catch {
    // Non-JSON response — surface the status, not the raw parse error.
    return {
      success: false,
      error: res.ok ? 'Unexpected server response (not JSON)' : `Request failed (HTTP ${res.status})`,
    };
  }
}
