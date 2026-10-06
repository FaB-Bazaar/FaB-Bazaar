import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { setsService } from '@/lib/services';
import { fetchTcgcsvGroups } from '@/lib/sets/tcgcsv-groups';

/**
 * GET /api/admin/cardvault/tcg-groups — every Flesh and Blood group on
 * TCGplayer (tcgcsv, cached an hour), newest first, with the set codes each
 * already prices (tcg_group_sets). Feeds the set form's group picker
 * (superadmin).
 */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (!gate.ok) return gate.response;

  let groups;
  try {
    groups = await fetchTcgcsvGroups();
  } catch (e) {
    return NextResponse.json({ error: `Could not load TCGplayer groups: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }

  const links = await setsService.listTcgGroupSets();
  const mapped = new Map<number, string[]>();
  for (const l of links.success ? links.data : []) mapped.set(l.groupId, [...(mapped.get(l.groupId) ?? []), l.setCode]);

  const data = [...groups]
    .sort((a, b) => (b.publishedOn ?? '').localeCompare(a.publishedOn ?? '') || b.groupId - a.groupId)
    .map((g) => ({ ...g, mappedTo: (mapped.get(g.groupId) ?? []).sort() }));
  return NextResponse.json({ success: true, data });
}
