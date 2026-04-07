"use client";

import { useState } from "react";
import { locationsClient } from "@/lib/client";
import type { LocationSubmissionDTO, SubmissionStatus } from "@/types/location";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TABS: { label: string; status: SubmissionStatus }[] = [
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
  { label: "Rejected", status: "rejected" },
];

function SubmissionCard({
  submission,
  onReviewed,
}: {
  submission: LocationSubmissionDTO;
  onReviewed: (id: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    const result = await locationsClient.adminReviewSubmission(submission.id, "approve");
    if (result.success) {
      onReviewed(submission.id);
    } else {
      setError(result.error ?? "Failed to approve");
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setLoading(true);
    setError(null);
    const result = await locationsClient.adminReviewSubmission(submission.id, "reject", reason);
    if (result.success) {
      onReviewed(submission.id);
    } else {
      setError(result.error ?? "Failed to reject");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{submission.storeName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {submission.storeAddressLine1}, {submission.storeAddressCity},{" "}
            {submission.storeAddressState} {submission.storeAddressPostalCode},{" "}
            {submission.storeAddressCountry}
          </p>
        </div>
        <Badge variant="outline" className="flex-shrink-0 capitalize">
          {submission.submitterRelationship}
        </Badge>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-300 grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-gray-400">Submitted by</span>
        <span>{submission.submitterName}</span>
        {submission.storeContactWebsite && (
          <>
            <span className="text-gray-400">Website</span>
            <span>{submission.storeContactWebsite}</span>
          </>
        )}
        {submission.storeContactEmail && (
          <>
            <span className="text-gray-400">Contact email</span>
            <span>{submission.storeContactEmail}</span>
          </>
        )}
        {submission.storeManagerName && (
          <>
            <span className="text-gray-400">Manager</span>
            <span>{submission.storeManagerName}</span>
          </>
        )}
        {submission.notes && (
          <>
            <span className="text-gray-400">Notes</span>
            <span>{submission.notes}</span>
          </>
        )}
        <span className="text-gray-400">Submitted</span>
        <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
      </div>

      {submission.status === "pending" && (
        <div className="flex flex-col gap-2 pt-1">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {rejecting ? (
            <div className="flex gap-2 items-start">
              <input
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Rejection reason…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              />
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading || !reason.trim()}>
                {loading ? "Rejecting…" : "Confirm"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApprove} disabled={loading}>
                {loading ? "Approving…" : "Approve"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={loading}>
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      {submission.status === "approved" && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Approved {submission.approvedAt ? `on ${new Date(submission.approvedAt).toLocaleDateString()}` : ""}
        </p>
      )}

      {submission.status === "rejected" && (
        <p className="text-sm text-red-500">
          Rejected{submission.rejectionReason ? `: ${submission.rejectionReason}` : ""}
        </p>
      )}
    </div>
  );
}

export function LocationSubmissionsClient({
  initialSubmissions,
}: {
  initialSubmissions: LocationSubmissionDTO[];
}) {
  const [activeTab, setActiveTab] = useState<SubmissionStatus>("pending");
  const [submissions, setSubmissions] = useState<LocationSubmissionDTO[]>(initialSubmissions);
  const [tabLoading, setTabLoading] = useState(false);

  async function handleTabChange(status: SubmissionStatus) {
    setActiveTab(status);
    setTabLoading(true);
    const result = await locationsClient.adminListSubmissions(status);
    if (result.success) {
      setSubmissions(result.data.submissions);
    }
    setTabLoading(false);
  }

  function handleReviewed(id: string) {
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            onClick={() => handleTabChange(tab.status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.status
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabLoading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No {activeTab} submissions.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} onReviewed={handleReviewed} />
          ))}
        </div>
      )}
    </div>
  );
}
