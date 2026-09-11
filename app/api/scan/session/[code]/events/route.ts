// GET /api/scan/session/[code]/events — server-sent events for the desktop:
//   {type:'status', paired}  once, then every existing item, then live
//   {type:'item', item} / {type:'paired'} as the phone works. Heartbeat
//   comments keep proxies from closing the idle stream.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { getScanSessionStore, loadOwnedSession, type ScanSessionItem } from '@/lib/scan/session-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 20_000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authenticateRequest(request, {});
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { code } = await params;
  const owned = await loadOwnedSession(getScanSessionStore(), code, auth.userId!);
  if (owned.status !== 200) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const store = getScanSessionStore();
  const encoder = new TextEncoder();
  let unsubscribe: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { /* closed */ }
      };
      const close = async () => {
        if (heartbeat) clearInterval(heartbeat);
        await unsubscribe?.();
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal?.addEventListener?.('abort', () => { void close(); });

      // subscribe BEFORE the snapshot so nothing appended in between is lost;
      // the client dedupes by item id.
      const seen = new Set<string>();
      unsubscribe = await store.subscribe(owned.record.code, {
        onItem: (item: ScanSessionItem) => { if (!seen.has(item.id)) { seen.add(item.id); send({ type: 'item', item }); } },
        onPaired: () => send({ type: 'paired' }),
      });
      const fresh = await store.get(owned.record.code);
      send({ type: 'status', paired: fresh?.pairedAt != null });
      for (const item of await store.listItems(owned.record.code)) {
        if (!seen.has(item.id)) { seen.add(item.id); send({ type: 'item', item }); }
      }
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch { void close(); }
      }, HEARTBEAT_MS);
    },
    async cancel() {
      if (heartbeat) clearInterval(heartbeat);
      await unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
