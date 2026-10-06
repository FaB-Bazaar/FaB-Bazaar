// lib/images/set-logo-upload.ts — put a set logo on Cloudflare Images for the
// /admin/cardvault set form. Convention: `set-<code>-logo` (MPW/IAR/TNP…).
// Cloudflare ids are immutable (a duplicate is rejected with 5409) and served
// through a cache, so REPLACING a logo uploads under a dated id instead of
// deleting and reusing the old one — the account is shared with other apps,
// and nothing here ever deletes.

export async function uploadSetLogo({ code, file, cloudflare, fetch: doFetch = fetch, now = () => new Date() }: {
  code: string;
  file: Blob;
  cloudflare: { accountId: string; apiToken: string };
  fetch?: typeof fetch;
  now?: () => Date;
}): Promise<{ ok: true; imageId: string } | { ok: false; error: string }> {
  const post = async (id: string) => {
    const form = new FormData();
    form.append('file', file, `${id}.png`);
    form.append('id', id);
    const res = await doFetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflare.accountId}/images/v1`,
      { method: 'POST', headers: { Authorization: `Bearer ${cloudflare.apiToken}` }, body: form });
    const body: any = await res.json().catch(() => ({}));
    const exists = (body.errors ?? []).some((e: any) => e.code === 5409 || /already exists/i.test(e.message ?? ''));
    return { ok: res.ok && body.success === true, exists, error: JSON.stringify(body.errors ?? res.status) };
  };

  const base = `set-${code.toLowerCase()}-logo`;
  const first = await post(base);
  if (first.ok) return { ok: true, imageId: base };
  if (!first.exists) return { ok: false, error: `Cloudflare rejected the logo: ${first.error}` };

  const stamp = now().toISOString().replace(/\D/g, '').slice(0, 14);
  const dated = `${base}-${stamp}`;
  const second = await post(dated);
  return second.ok ? { ok: true, imageId: dated } : { ok: false, error: `Cloudflare rejected the logo: ${second.error}` };
}
