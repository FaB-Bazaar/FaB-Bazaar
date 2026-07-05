// Resolves a destructive-tool confirmation for the hosted Fabby chat.
//
// The chat stream pauses on remove_* tool calls and emits a
// confirmation_request event; the UI posts the user's decision here, which
// releases the pending agent loop via the in-memory registry
// (lib/ai/confirmations). Same gates as the parent chat route.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { canUseFabbyChat } from '@/lib/ai/fabby-chat-access';
import { resolveConfirmation } from '@/lib/ai/confirmations';
import type { ConfirmationDecision } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

const DECISIONS = new Set<ConfirmationDecision>(['confirm', 'deny']);

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const access = await userService.getFabbyChatAccess(user.id);
  if (!access.success || !canUseFabbyChat(access.data)) {
    return NextResponse.json({ error: 'Forbidden - Fabby Chat access required' }, { status: 403 });
  }

  let body: { id?: unknown; decision?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, decision } = body ?? {};
  if (typeof id !== 'string' || !id || !DECISIONS.has(decision as ConfirmationDecision)) {
    return NextResponse.json({ error: 'Body must be { id: string, decision: "confirm" | "deny" }' }, { status: 400 });
  }

  // Registry keys include the session user id, so this can only ever release
  // the caller's own pending tool call.
  const resolved = resolveConfirmation(user.id, id, decision as ConfirmationDecision);
  if (!resolved) {
    return NextResponse.json({ error: 'No pending confirmation for that id — it may have expired' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { resolved: true } });
}
