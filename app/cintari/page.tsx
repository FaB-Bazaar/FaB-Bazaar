// /cintari — integration guide for Cintari (a game client): connecting a
// FaB Bazaar player through OAuth 2.1 and using the partner play API.
// Public, static. Facts here must match app/oauth/* and
// app/api/partner/v1/play/* — the OpenAPI spec is the contract.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Connecting Cintari to FaB Bazaar",
  description: "How Cintari connects a FaB Bazaar player with OAuth 2.1 and loads the decks they send it.",
};

const SITE = "https://fabbazaar.app";
const OPENAPI = `${SITE}/api/partner/v1/openapi.json`;
const METADATA = `${SITE}/.well-known/oauth-authorization-server`;

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm";
const LINK = `text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 ${FOCUS}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-md border border-gray-300 bg-gray-100 p-4 text-sm leading-relaxed text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.9em] text-gray-900 dark:bg-gray-800 dark:text-gray-100">{children}</code>
);

function Step({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-gray-300 pt-8 dark:border-gray-700">
      <h2 id={id} className="mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="space-y-3 text-base leading-relaxed text-gray-800 dark:text-gray-200">{children}</div>
    </section>
  );
}

export default function CintariGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Connecting Cintari to FaB Bazaar</h1>
      <p className="mt-3 text-lg text-gray-800 dark:text-gray-200">
        Cintari connects with standard OAuth 2.1 (authorization code + PKCE), then calls the FaB Bazaar Partner API on
        each player&apos;s behalf. Players choose, per deck, which decks Cintari gets.
      </p>
      <p className="mt-3 text-base text-gray-700 dark:text-gray-300">
        Machine-readable reference: <a className={LINK} href={OPENAPI}>openapi.json</a> (every endpoint, its scope and
        its schemas) · OAuth server metadata: <a className={LINK} href={METADATA}>oauth-authorization-server</a>.
      </p>

      <nav aria-label="Steps" className="my-8 rounded-md border border-gray-300 p-4 dark:border-gray-700">
        <ol className="list-decimal space-y-1 pl-5 text-base">
          {[
            ["register", "Register Cintari once"],
            ["connect", "Connect a player"],
            ["tokens", "Exchange the code for tokens"],
            ["refresh", "Keep the tokens fresh"],
            ["decks", "Load the player's decks"],
            ["matchups", "Save matchup plans"],
            ["notes", "Good to know"],
          ].map(([id, label]) => (
            <li key={id}><a className={LINK} href={`#${id}`}>{label}</a></li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        <Step id="register" title="Step 1 · Register Cintari once">
          <p>Your server registers Cintari as an OAuth client (RFC 7591). Do this once, not per player.</p>
          <Code>{`POST ${SITE}/oauth/register
Content-Type: application/json

{
  "client_name": "Cintari",
  "client_uri": "https://your-cintari-site",
  "redirect_uris": ["https://your-cintari-site/auth/fabbazaar/callback"]
}`}</Code>
          <p>
            The <C>201</C> response holds <C>client_id</C> and <C>client_secret</C>. <strong>The secret is shown only
            this once</strong>: store it on your server, never in the game client or a browser. Players see{" "}
            <C>client_name</C> on the approval screen.
          </p>
          <p>
            Redirect URIs must be HTTPS (<C>http://localhost</C> works for testing) and are matched exactly later.
          </p>
        </Step>

        <Step id="connect" title="Step 2 · Connect a player">
          <p>When a signed-in Cintari user clicks “Connect FaB Bazaar”, your server:</p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              Makes a random <C>state</C> and saves it against <strong>that Cintari user</strong> (or their session).
              This is how you know whose tokens come back in Step 3, and it stops someone slipping their own approval
              into another person&apos;s session.
            </li>
            <li>
              Makes a PKCE <C>code_verifier</C> (random, 43–128 characters), keeps it with the <C>state</C>, and
              derives <C>code_challenge</C> = base64url(SHA-256(code_verifier)).
            </li>
            <li>Sends the player&apos;s browser to:</li>
          </ol>
          <Code>{`${SITE}/oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https%3A%2F%2Fyour-cintari-site%2Fauth%2Ffabbazaar%2Fcallback
  &scope=decks%3Awrite
  &state=RANDOM_STATE
  &code_challenge=CODE_CHALLENGE
  &code_challenge_method=S256`}</Code>
          <p>
            The player signs in to FaB Bazaar if they aren&apos;t already, sees “Allow Cintari to connect to your FaB
            Bazaar account?” with exactly what it may do, and clicks Allow. A player who already approved Cintari
            (and hasn&apos;t removed it) skips that screen.
          </p>
          <p>FaB Bazaar then sends them back to your redirect URI:</p>
          <Code>{`https://your-cintari-site/auth/fabbazaar/callback?code=ONE_TIME_CODE&state=RANDOM_STATE
https://your-cintari-site/auth/fabbazaar/callback?error=access_denied&state=RANDOM_STATE   ← they clicked Deny`}</Code>
          <p>
            Look up <C>state</C> to find the Cintari user who started this; reject the callback if it is unknown or
            already used.
          </p>
          <p>
            <strong>Scopes.</strong> Ask for <C>decks:read</C> to list and load decks, or <C>decks:write</C> to also
            save matchup plans (write includes read). Request only partner scopes{" "}
            (<C>cards:read</C>, <C>collection:read</C>, <C>collection:write</C>, <C>decks:read</C>, <C>decks:write</C>):
            asking for anything else, or leaving <C>scope</C> out, gets a token the Partner API refuses.
          </p>
        </Step>

        <Step id="tokens" title="Step 3 · Exchange the code for tokens">
          <p>Within 10 minutes, and from your server, swap the code for tokens:</p>
          <Code>{`POST ${SITE}/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=ONE_TIME_CODE
&redirect_uri=https://your-cintari-site/auth/fabbazaar/callback   (exactly as in Step 2)
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&code_verifier=CODE_VERIFIER`}</Code>
          <Code>{`{
  "access_token": "…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "…",
  "scope": "decks:write"
}`}</Code>
          <p>
            Save both tokens on the Cintari user found through <C>state</C>. That is the whole link between the two
            accounts: each token belongs to the FaB Bazaar player who approved it, and every call made with it reads
            and writes only that player&apos;s data. FaB Bazaar never needs your user ids. (JSON bodies are accepted
            too, and the client may authenticate with HTTP Basic instead of <C>client_secret</C> in the body.)
          </p>
        </Step>

        <Step id="refresh" title="Step 4 · Keep the tokens fresh">
          <p>Access tokens last one hour. Refresh before or when a call answers <C>401</C>:</p>
          <Code>{`POST ${SITE}/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=REFRESH_TOKEN
&client_id=YOUR_CLIENT_ID`}</Code>
          <p>
            <strong>Every refresh returns a new refresh token, and the old one stops working.</strong> Store the new
            one each time (and refresh one player at a time, or two refreshes race and one loses).
          </p>
          <p>
            Refresh tokens currently stop working 30 days after the player connected. When a refresh fails, send the
            player through Step 2 again; if they already approved Cintari, that is a quick redirect with no screen.
          </p>
        </Step>

        <Step id="decks" title="Step 5 · Load the player's decks">
          <p>
            Call the Partner API with <C>Authorization: Bearer ACCESS_TOKEN</C>. Base URL:{" "}
            <C>{`${SITE}/api/partner/v1`}</C>.
          </p>
          <p>
            A player picks which decks Cintari gets in each deck&apos;s Settings → <strong>Send to</strong>. These
            endpoints only ever see those decks; anything else answers <C>404</C>. Cintari appears there once it holds
            a token for that player (after Step 3).
          </p>
          <h3 className="pt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">List the decks sent to Cintari</h3>
          <Code>{`GET ${SITE}/api/partner/v1/play/decks?format=Blitz&page=1&limit=50

{
  "success": true,
  "data": [
    {
      "id": "Xk2…",
      "name": "Aether Kano",
      "format": "Blitz",
      "hero": "Kano",
      "hero_card_id": "ARC114",
      "total_cards": 52,
      "updated_at": "2026-11-20T10:00:00.000Z",
      "play_url": "/api/partner/v1/play/decks/Xk2…"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "total_pages": 1 }
}`}</Code>
          <p>
            Most recently changed first. <C>format</C> is optional and uses FaB Bazaar&apos;s names{" "}
            (<C>Classic Constructed</C>, <C>Blitz</C>, <C>Silver Age</C>, …). <C>limit</C> is 1–100.
          </p>
          <h3 className="pt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Load one deck to play</h3>
          <Code>{`GET ${SITE}/api/partner/v1/play/decks/{deckId}
GET ${SITE}/api/partner/v1/play/decks/{deckId}?matchup=briar_warden_of_thorns   (apply that plan's swaps)
GET ${SITE}/api/partner/v1/play/decks/{deckId}?include_art=1                   (add card images)

{
  "success": true,
  "data": {
    "name": "Aether Kano",
    "format": "blitz",
    "cards": [
      { "identifier": "kano", "total": 1 },
      { "identifier": "blazing_aether_red", "total": 2 },
      { "identifier": "sink_below_red", "total": 0, "sideboardTotal": 1 }
    ],
    "matchups": [ … ],
    "art": { "ARC114": "https://imagedelivery.net/…" }
  }
}`}</Code>
          <p>
            This is exactly what Talishar imports: card counts by Talishar card id (<C>total</C> in the deck — hero,
            equipment and main deck; <C>sideboardTotal</C> in the inventory), a Talishar format code, and the matchup
            plans. It comes from the list the player picked for playing: a saved version of the deck, or the deck as
            it is now.
          </p>
        </Step>

        <Step id="matchups" title="Step 6 · Save matchup plans">
          <p>
            A matchup plan is the sideboarding against one hero: cards brought in from the inventory and taken out of
            the deck, one entry per copy, as Talishar card ids. Needs <C>decks:write</C>.
          </p>
          <Code>{`GET    ${SITE}/api/partner/v1/play/decks/{deckId}/matchups
PUT    ${SITE}/api/partner/v1/play/decks/{deckId}/matchups/{heroId}
DELETE ${SITE}/api/partner/v1/play/decks/{deckId}/matchups/{heroId}

PUT …/matchups/briar_warden_of_thorns
{
  "preferred_turn_order": "First",        // "First" | "Second" | "NoPreference" | null
  "notes": "Race them; keep blue up.",    // up to 500 characters, or null
  "sideboard": {
    "in":  ["sink_below_red"],
    "out": ["blazing_aether_red"]
  }
}`}</Code>
          <p>
            <C>heroId</C> is a Talishar hero id (<C>briar_warden_of_thorns</C>; young heroes by first name,{" "}
            <C>briar</C>) or a strategy: <C>core</C>, <C>aggro</C>, <C>fatigue</C>, <C>combo</C>, <C>midrange</C>.
            A <C>PUT</C> replaces any plan for that hero and answers <C>201</C> (new) or <C>200</C> (replaced).
          </p>
          <p>
            The plan is checked against the list the player plays. If a card isn&apos;t in that zone, or not enough
            copies, the whole plan is rejected — nothing is trimmed silently:
          </p>
          <Code>{`400
{
  "success": false,
  "error": {
    "code": "invalid_matchup",
    "message": "Card 'sink_below_blue' - need 1 copies in sideboard, only 0 available",
    "details": { "errors": [ "Card 'sink_below_blue' - need 1 copies in sideboard, only 0 available" ] }
  }
}`}</Code>
        </Step>

        <Step id="notes" title="Good to know">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Errors</strong> always look like{" "}
              <C>{`{ "success": false, "error": { "code", "message", "details"? } }`}</C>. Branch on <C>code</C>{" "}
              (<C>unauthorized</C>, <C>insufficient_scope</C>, <C>invalid_request</C>, <C>invalid_matchup</C>,{" "}
              <C>not_found</C>), not on the message.
            </li>
            <li>
              <strong>Disconnects.</strong> A player can remove Cintari under their connected accounts on FaB Bazaar.
              Calls and refreshes then fail with <C>401</C>: mark that Cintari user as not connected and offer Step 2
              again.
            </li>
            <li>
              <strong>A deck stopped showing up</strong> (<C>404</C>) means the player switched off “Send to” for it
              or deleted it.
            </li>
            <li>
              <strong>Who is connected.</strong> The API has no “who am I” endpoint yet. Identify the link by your own
              user (via <C>state</C>), not by anything inside the token.
            </li>
            <li>
              <strong>Be gentle.</strong> Cache deck lists and exports between games instead of fetching per action;
              heavy bursts from one address are rate limited.
            </li>
            <li>
              Fields are only ever added within <C>v1</C>, never renamed or removed. The full contract is in{" "}
              <a className={LINK} href={OPENAPI}>openapi.json</a>.
            </li>
          </ul>
        </Step>
      </div>
    </main>
  );
}
