"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locationsClient } from "@/lib/client";
import type { SubmitterRelationship } from "@/types/location";

const RELATIONSHIPS: { value: SubmitterRelationship; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
  { value: "customer", label: "Regular customer" },
  { value: "other", label: "Other" },
];

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function SubmitStorePage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [submissionId, setSubmissionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    submitterName: "",
    submitterEmail: "",
    submitterPhone: "",
    submitterRelationship: "customer" as SubmitterRelationship,
    storeName: "",
    storeAddressLine1: "",
    storeAddressCity: "",
    storeAddressState: "",
    storeAddressPostalCode: "",
    storeAddressCountry: "",
    storeContactPhone: "",
    storeContactEmail: "",
    storeContactWebsite: "",
    storeManagerName: "",
    storeManagerEmail: "",
    storeManagerPhone: "",
    tcgplayerStorefrontUrl: "",
    discordInviteUrl: "",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await locationsClient.createSubmission({
      ...form,
      submitterPhone: form.submitterPhone || undefined,
      storeContactPhone: form.storeContactPhone || undefined,
      storeContactEmail: form.storeContactEmail || undefined,
      storeContactWebsite: form.storeContactWebsite || undefined,
      storeManagerName: form.storeManagerName || undefined,
      storeManagerEmail: form.storeManagerEmail || undefined,
      storeManagerPhone: form.storeManagerPhone || undefined,
      tcgplayerStorefrontUrl: form.tcgplayerStorefrontUrl || undefined,
      discordInviteUrl: form.discordInviteUrl || undefined,
      notes: form.notes || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      setSubmissionId(result.data.id);
      setStep("success");
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Submission received!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
            We'll review your submission and add the store once verified.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Reference ID: <span className="font-mono">{submissionId}</span>
          </p>
          <Link href="/stores/browse">
            <Button className="w-full">Back to browse</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/stores/browse"
          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to browse
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Submit a Store
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Help grow the FaB Bazaar store directory. We'll review and add it within a few days.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Section 1: About you */}
          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">About you</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <Input
                  value={form.submitterName}
                  onChange={(e) => set("submitterName", e.target.value)}
                  required
                  placeholder="Jane Smith"
                />
              </Field>
              <Field label="Your email" required>
                <Input
                  type="email"
                  value={form.submitterEmail}
                  onChange={(e) => set("submitterEmail", e.target.value)}
                  required
                  placeholder="jane@example.com"
                />
              </Field>
              <Field label="Your phone">
                <Input
                  value={form.submitterPhone}
                  onChange={(e) => set("submitterPhone", e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </Field>
              <Field label="Your relationship to the store" required>
                <select
                  value={form.submitterRelationship}
                  onChange={(e) => set("submitterRelationship", e.target.value)}
                  className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
                  required
                >
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Section 2: Store info */}
          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Store information</h2>

            <Field label="Store name" required>
              <Input
                value={form.storeName}
                onChange={(e) => set("storeName", e.target.value)}
                required
                placeholder="Level Up Games"
              />
            </Field>

            <Field label="Address" required>
              <Input
                value={form.storeAddressLine1}
                onChange={(e) => set("storeAddressLine1", e.target.value)}
                required
                placeholder="123 Main St"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" required>
                <Input
                  value={form.storeAddressCity}
                  onChange={(e) => set("storeAddressCity", e.target.value)}
                  required
                  placeholder="Atlanta"
                />
              </Field>
              <Field label="State / Province" required>
                <Input
                  value={form.storeAddressState}
                  onChange={(e) => set("storeAddressState", e.target.value)}
                  required
                  placeholder="GA"
                />
              </Field>
              <Field label="Postal code" required>
                <Input
                  value={form.storeAddressPostalCode}
                  onChange={(e) => set("storeAddressPostalCode", e.target.value)}
                  required
                  placeholder="30301"
                />
              </Field>
              <Field label="Country" required>
                <Input
                  value={form.storeAddressCountry}
                  onChange={(e) => set("storeAddressCountry", e.target.value)}
                  required
                  placeholder="US"
                  maxLength={2}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store phone">
                <Input
                  value={form.storeContactPhone}
                  onChange={(e) => set("storeContactPhone", e.target.value)}
                  placeholder="(404) 555-0000"
                />
              </Field>
              <Field label="Store email">
                <Input
                  type="email"
                  value={form.storeContactEmail}
                  onChange={(e) => set("storeContactEmail", e.target.value)}
                  placeholder="info@store.com"
                />
              </Field>
              <Field label="Website">
                <Input
                  value={form.storeContactWebsite}
                  onChange={(e) => set("storeContactWebsite", e.target.value)}
                  placeholder="https://store.com"
                />
              </Field>
              <Field label="TCGPlayer storefront URL">
                <Input
                  value={form.tcgplayerStorefrontUrl}
                  onChange={(e) => set("tcgplayerStorefrontUrl", e.target.value)}
                  placeholder="https://tcgplayer.com/..."
                />
              </Field>
            </div>

            <Field label="Discord invite URL">
              <Input
                value={form.discordInviteUrl}
                onChange={(e) => set("discordInviteUrl", e.target.value)}
                placeholder="https://discord.gg/..."
              />
            </Field>
          </section>

          {/* Section 3: Additional */}
          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Additional details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Manager name">
                <Input
                  value={form.storeManagerName}
                  onChange={(e) => set("storeManagerName", e.target.value)}
                  placeholder="John Doe"
                />
              </Field>
              <Field label="Manager email">
                <Input
                  type="email"
                  value={form.storeManagerEmail}
                  onChange={(e) => set("storeManagerEmail", e.target.value)}
                  placeholder="manager@store.com"
                />
              </Field>
              <Field label="Manager phone">
                <Input
                  value={form.storeManagerPhone}
                  onChange={(e) => set("storeManagerPhone", e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Anything else we should know…"
                className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          </section>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit store"}
          </Button>
        </form>
      </div>
    </div>
  );
}
