import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { setsService } from '@/lib/services';
import { parseSetInput } from '@/lib/sets/set-input';
import { refreshSetOverlay } from '@/lib/fab-constants/set-overlay-server';

/**
 * POST /api/admin/cardvault/sets — register a new set (superadmin). Writes the
 * `sets` row + its TCGplayer groups, then refreshes the runtime set overlay so
 * the set shows across the site at once (lib/fab-constants/set-overlay.ts).
 */
export async function POST(request: NextRequest) {
  let body: unknown = {};
  try { body = await request.json(); } catch { /* validated below */ }
  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;

  const parsed = parseSetInput(body, 'register');
  if (!parsed.ok) return NextResponse.json({ error: 'Some fields need fixing', fields: parsed.errors }, { status: 400 });

  const created = await setsService.registerSet(parsed.value);
  if (!created.success) {
    const status = /already registered/.test(created.error) ? 409 : 500;
    return NextResponse.json({ error: created.error }, { status });
  }
  await refreshSetOverlay();
  return NextResponse.json({ success: true, data: created.data }, { status: 201 });
}
