// app/oauth/consent/page.tsx
//
// The consent screen of the OAuth flow: shows which app is asking and what it
// would be able to do, and posts the user's Allow / Deny to /oauth/consent/decision.
// /oauth/authorize sends users here; this page issues nothing itself.
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { oauthFlowService } from '@/lib/services';
import { classifyScopeRequest, consentLines } from '@/lib/oauth/consent';
import { displayUsername } from '@/lib/utils/display-username';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Authorize app — FaB Bazaar', robots: { index: false } };

const PARAM_KEYS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

function hostOf(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: Partial<Record<(typeof PARAM_KEYS)[number], string>> = {};
  for (const key of PARAM_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && value !== '') params[key] = value;
  }
  const query = new URLSearchParams(params as Record<string, string>).toString();

  // Signed out, or a request that does not hold up: /oauth/authorize owns both
  // cases (sign-in redirect, error page), so hand the request back to it.
  const session = await auth();
  if (!session?.user?.id || !params.client_id) redirect(`/oauth/authorize?${query}`);

  const clientResult = await oauthFlowService.validateClient(params.client_id, params.redirect_uri);
  if (!clientResult.success) redirect(`/oauth/authorize?${query}`);
  const client = clientResult.data;

  const request = classifyScopeRequest(params.scope);
  const lines = consentLines(request);
  const returnHost = hostOf(params.redirect_uri ?? client.redirect_uris?.[0]);
  const username = (session.user as { username?: string }).username;
  const signedInAs = username ? displayUsername(username) : session.user.name;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Allow <span className="break-words">{client.client_name}</span> to connect to your FaB Bazaar account?
        </h1>

        {returnHost && (
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            This app is at <span className="font-medium text-gray-900 dark:text-gray-100">{returnHost}</span>. Only
            continue if you trust it.
          </p>
        )}

        <h2 className="mt-5 text-sm font-medium text-gray-900 dark:text-gray-100">It will be able to:</h2>
        <ul className="mt-2 space-y-2" data-testid="consent-permissions">
          {lines.map(line => (
            <li key={line} className="flex gap-2 text-sm text-gray-800 dark:text-gray-200">
              <span aria-hidden="true">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {request.kind === 'full' ? (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
            Only allow this for an app you trust with your whole account.
          </p>
        ) : (
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">It will not be able to do anything else.</p>
        )}

        <form method="POST" action="/oauth/consent/decision" className="mt-6 flex gap-3">
          {PARAM_KEYS.map(key =>
            params[key] !== undefined ? <input key={key} type="hidden" name={key} value={params[key]} /> : null,
          )}
          <button
            type="submit"
            name="decision"
            value="deny"
            className={`min-h-11 flex-1 rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800 ${FOCUS}`}
          >
            Deny
          </button>
          <button
            type="submit"
            name="decision"
            value="allow"
            className={`min-h-11 flex-1 rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 ${FOCUS}`}
          >
            Allow
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
          {signedInAs ? <>Signed in as {signedInAs}. </> : null}
          You can remove this access at any time under Profile → Connected accounts.
        </p>
      </div>
    </div>
  );
}
