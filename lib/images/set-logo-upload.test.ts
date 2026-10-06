import { describe, it, expect } from 'vitest';
import { uploadSetLogo } from './set-logo-upload';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const file = new Blob(['png-bytes'], { type: 'image/png' });

function fakeFetch(responses: Array<(id: string) => Response>) {
  const ids: string[] = [];
  let i = 0;
  const fn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const id = String((init!.body as FormData).get('id'));
    ids.push(id);
    return responses[i++](id);
  }) as typeof fetch;
  return { fn, ids };
}

const cf = { accountId: 'acc', apiToken: 'tok' };

describe('uploadSetLogo', () => {
  it('uses the conventional set-<code>-logo id when it is free', async () => {
    const f = fakeFetch([() => json({ success: true, result: { id: 'set-spw-logo' } })]);
    const r = await uploadSetLogo({ code: 'spw', file, cloudflare: cf, fetch: f.fn, now: () => new Date('2026-10-06T08:00:00Z') });
    expect(r).toEqual({ ok: true, imageId: 'set-spw-logo' });
    expect(f.ids).toEqual(['set-spw-logo']);
  });

  it('replacing a logo uploads under a dated id (Cloudflare ids are immutable and cached)', async () => {
    const f = fakeFetch([
      () => json({ success: false, errors: [{ code: 5409, message: 'Resource already exists' }] }, 409),
      () => json({ success: true, result: { id: 'x' } }),
    ]);
    const r = await uploadSetLogo({ code: 'spw', file, cloudflare: cf, fetch: f.fn, now: () => new Date('2026-10-06T08:05:09Z') });
    expect(r).toEqual({ ok: true, imageId: 'set-spw-logo-20261006080509' });
  });

  it('reports a Cloudflare failure', async () => {
    const f = fakeFetch([() => json({ success: false, errors: [{ code: 5400, message: 'Bad image' }] }, 400)]);
    const r = await uploadSetLogo({ code: 'spw', file, cloudflare: cf, fetch: f.fn });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/Bad image/) });
  });
});
