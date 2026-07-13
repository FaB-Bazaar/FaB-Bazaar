import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';

type Gate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Public facet gate: ANY signed-in user (session, MCP token, or OAuth bearer) —
 * no curator/superadmin role required. These routes power the community-facing
 * card-facet page (apply/remove existing tags, suggest new ones). `allowOAuth`
 * so Volzar + OAuth clients authenticate, not just Claude Desktop.
 */
export async function requireSignedIn(request: NextRequest, body: unknown = {}): Promise<Gate> {
  const authResult = await authenticateRequest(request, body, { allowOAuth: true });
  if (!authResult.success || !authResult.userId) {
    return { ok: false, response: NextResponse.json({ error: authResult.error ?? 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true, userId: authResult.userId };
}
