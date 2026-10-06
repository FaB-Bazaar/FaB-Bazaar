import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { setsService } from '@/lib/services';
import { parseSetInput } from '@/lib/sets/set-input';
import { refreshSetOverlay } from '@/lib/fab-constants/set-overlay-server';

type Ctx = { params: Promise<{ code: string }> };

/** GET /api/admin/cardvault/sets/[code] — a set and its TCGplayer groups (superadmin). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;
  const code = (await params).code.toLowerCase();

  const [set, links] = await Promise.all([setsService.getSetByCode(code), setsService.listTcgGroupSets()]);
  if (!set.success) return NextResponse.json({ error: set.error }, { status: 500 });
  if (!set.data) return NextResponse.json({ error: `unknown set '${code}'` }, { status: 404 });
  const tcgGroups = links.success
    ? links.data.filter((l) => l.setCode === code).map((l) => ({ groupId: l.groupId, name: l.setName }))
    : [];
  return NextResponse.json({ success: true, data: { set: set.data, tcgGroups } });
}

/**
 * PATCH /api/admin/cardvault/sets/[code] — edit a set (superadmin). Only the
 * fields sent change; tcgGroups are added. Refreshes the runtime set overlay.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  let body: unknown = {};
  try { body = await request.json(); } catch { /* validated below */ }
  const gate = await requireSuperAdmin(request, body);
  if (!gate.ok) return gate.response;
  const code = (await params).code.toLowerCase();

  const parsed = parseSetInput(body, 'update');
  if (!parsed.ok) return NextResponse.json({ error: 'Some fields need fixing', fields: parsed.errors }, { status: 400 });

  const updated = await setsService.updateSet(code, parsed.value);
  if (!updated.success) {
    const status = /unknown set/.test(updated.error) ? 404 : 500;
    return NextResponse.json({ error: updated.error }, { status });
  }
  await refreshSetOverlay();
  return NextResponse.json({ success: true, data: updated.data });
}
