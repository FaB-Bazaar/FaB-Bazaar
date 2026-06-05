"use client";

import { useState } from "react";
import type { LocationSubmissionDTO } from "@/types/location";
import { LocationSubmissionsClient } from "./LocationSubmissionsClient";
import { CreateEventForm } from "./CreateEventForm";

type AdminTab = "submissions" | "create";

const TABS: { label: string; value: AdminTab }[] = [
  { label: "Submissions", value: "submissions" },
  { label: "Add event / venue", value: "create" },
];

export function AdminLocationsClient({
  initialSubmissions,
}: {
  initialSubmissions: LocationSubmissionDTO[];
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("submissions");

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "submissions" ? (
        <LocationSubmissionsClient initialSubmissions={initialSubmissions} />
      ) : (
        <CreateEventForm />
      )}
    </div>
  );
}
