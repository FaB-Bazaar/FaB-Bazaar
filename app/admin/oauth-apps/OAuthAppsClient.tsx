"use client";

// /admin/oauth-apps: the allow-list (with Remove), the most recently
// registered apps (with Approve for the partner API), and a form to allow an
// assistant's return address by hand. API: /api/admin/oauth-apps.

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Access = "full" | "partner" | "all";

interface Entry {
  id: string;
  kind: "redirect_host" | "client_id";
  value: string;
  label: string;
  access: Access;
  createdAt: string;
}

interface RecentApp {
  clientId: string;
  name: string;
  site: string | null;
  returnHosts: string[];
  registeredAt: string;
  lastUsed: string | null;
  approved: { full: boolean; partner: boolean };
}

const ACCESS_LABEL: Record<Access, string> = {
  full: "Full account",
  partner: "Partner API",
  all: "Full account + partner API",
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const BUTTON = `rounded-sm border border-gray-400 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 ${FOCUS}`;
const DANGER = `rounded-sm border border-red-700 bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50 ${FOCUS}`;
const TH = "px-3 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300";
const TD = "px-3 py-2 align-top text-sm text-gray-900 dark:text-gray-100";
const INPUT = `w-full rounded-sm border border-gray-400 bg-white px-2 py-1.5 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${FOCUS}`;

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

function status(approved: RecentApp["approved"]) {
  if (approved.full && approved.partner) return ACCESS_LABEL.all;
  if (approved.full) return ACCESS_LABEL.full;
  if (approved.partner) return ACCESS_LABEL.partner;
  return "Not approved";
}

export function OAuthAppsClient() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [host, setHost] = useState("");
  const [label, setLabel] = useState("");
  const [access, setAccess] = useState<Access>("full");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/oauth-apps");
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.data) {
      setLoadError(body?.error ?? "Could not load the apps");
      return;
    }
    setLoadError(null);
    setEntries(body.data.entries);
    setRecent(body.data.recentApps);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (input: { kind: Entry["kind"]; value: string; label: string; access: Access }) => {
    const res = await fetch("/api/admin/oauth-apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return body?.error ?? "Could not add it";
    await load();
    return null;
  };

  const approvePartner = async (app: RecentApp) => {
    setBusy(app.clientId);
    setActionError(null);
    const error = await add({ kind: "client_id", value: app.clientId, label: app.name, access: "partner" });
    if (error) setActionError(`${app.name}: ${error}`);
    setBusy(null);
  };

  const remove = async (entry: Entry) => {
    setBusy(entry.id);
    setActionError(null);
    const res = await fetch(`/api/admin/oauth-apps/${entry.id}`, { method: "DELETE" });
    if (!res.ok) setActionError(`Could not remove ${entry.label}`);
    setConfirming(null);
    await load();
    setBusy(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const error = await add({ kind: "redirect_host", value: host, label, access });
    if (error) {
      setFormError(error);
      return;
    }
    setHost("");
    setLabel("");
  };

  if (loadError) return <p role="alert" className="text-red-700 dark:text-red-300">{loadError}</p>;
  if (!entries) return <p className="text-gray-700 dark:text-gray-300">Loading…</p>;

  return (
    <div className="space-y-10">
      {actionError && <p role="alert" className="text-red-700 dark:text-red-300">{actionError}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Allowed</h2>
        <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
          <table aria-label="Allowed" className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={TH}>Allowed by</th>
                <th scope="col" className={TH}>Access</th>
                <th scope="col" className={TH}>Added</th>
                <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-800">
                  <td className={TD}>{entry.label}</td>
                  <td className={TD}>
                    <span className="text-gray-700 dark:text-gray-300">{entry.kind === "redirect_host" ? "Return address " : "App "}</span>
                    <code className="break-all">{entry.value}</code>
                  </td>
                  <td className={TD}>{ACCESS_LABEL[entry.access]}</td>
                  <td className={TD}>{day(entry.createdAt)}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    {confirming === entry.id ? (
                      <span className="inline-flex gap-2">
                        <button type="button" className={DANGER} disabled={busy === entry.id} aria-label={`Confirm removing ${entry.label}`} onClick={() => remove(entry)}>
                          Remove
                        </button>
                        <button type="button" className={BUTTON} onClick={() => setConfirming(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className={BUTTON} aria-label={`Remove ${entry.label}`} onClick={() => setConfirming(entry.id)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Removing an entry stops its apps at their next request (within an hour for apps already connected).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recently registered apps</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Anyone can register an app. Before approving one, check its return address is really theirs: an app named
          “Cintari” returning to some other site is not Cintari.
        </p>
        <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
          <table aria-label="Recently registered apps" className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={TH}>Returns to</th>
                <th scope="col" className={TH}>Registered</th>
                <th scope="col" className={TH}>Last used</th>
                <th scope="col" className={TH}>Approved for</th>
                <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {recent.map(app => (
                <tr key={app.clientId} className="border-t border-gray-200 dark:border-gray-800">
                  <td className={TD}>
                    {app.name}
                    {app.site && <span className="block text-gray-700 dark:text-gray-300">{app.site}</span>}
                    <code className="block break-all text-xs text-gray-700 dark:text-gray-300">{app.clientId}</code>
                  </td>
                  <td className={TD}><code className="break-all">{app.returnHosts.join(", ") || "—"}</code></td>
                  <td className={TD}>{day(app.registeredAt)}</td>
                  <td className={TD}>{day(app.lastUsed)}</td>
                  <td className={TD}>{status(app.approved)}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    {!app.approved.partner && (
                      <button
                        type="button"
                        className={BUTTON}
                        disabled={busy === app.clientId}
                        aria-label={`Approve ${app.name} for the partner API`}
                        onClick={() => approvePartner(app)}
                      >
                        Approve for partner API
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Add a return address</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          For an AI assistant: every app that sends players back to this host is allowed (exact host, no subdomains).
        </p>
        <form aria-label="Add a return address" onSubmit={submit} className="grid max-w-3xl gap-3 sm:grid-cols-[2fr_2fr_1.5fr_auto] sm:items-end">
          <label className="space-y-1 text-sm font-medium">
            <span>Host</span>
            <input className={INPUT} value={host} onChange={e => setHost(e.target.value)} placeholder="chatgpt.com" required />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Name</span>
            <input className={INPUT} value={label} onChange={e => setLabel(e.target.value)} placeholder="ChatGPT" required />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Access</span>
            <select className={INPUT} value={access} onChange={e => setAccess(e.target.value as Access)}>
              <option value="full">{ACCESS_LABEL.full}</option>
              <option value="partner">{ACCESS_LABEL.partner}</option>
              <option value="all">{ACCESS_LABEL.all}</option>
            </select>
          </label>
          <button type="submit" className={`${BUTTON} py-2 text-base`}>Add</button>
          {formError && <p role="alert" className="text-sm text-red-700 dark:text-red-300 sm:col-span-4">{formError}</p>}
        </form>
      </section>
    </div>
  );
}
