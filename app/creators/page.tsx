"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserCircle, CheckCircle2 } from "lucide-react";
import { customTokenCardsClient } from "@/lib/client";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import type { CustomTokenCardCreatorDTO } from "@/lib/services/contracts/ICustomTokenCardService";

export default function CreatorsIndexPage() {
  const [creators, setCreators] = useState<CustomTokenCardCreatorDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await customTokenCardsClient.listCreators();
      if (result.success) setCreators(result.data);
      else setError(result.error);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Custom Token Card Creators
          </h1>
          <DarkModeToggle />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Loading creators…</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : creators.length === 0 ? (
          <div className="text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-12">
            <UserCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">No creators yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Check back soon as creators publish their custom token cards.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {creators.map((c) => (
              <Link
                key={c.id}
                href={`/creators/${encodeURIComponent(c.slug)}`}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-center mb-3">
                  {c.avatarUrl ? (
                    <Image
                      src={c.avatarUrl}
                      alt={c.displayName}
                      width={80}
                      height={80}
                      className="rounded-full"
                    />
                  ) : (
                    <UserCircle className="h-20 w-20 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <h2 className="text-sm font-semibold text-center text-gray-900 dark:text-gray-100 truncate">
                    {c.displayName}
                  </h2>
                  {c.isVerified && <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" aria-label="Verified" />}
                </div>
                <div className="flex justify-center">
                  <Badge variant="secondary" className="text-xs">
                    {c.tokenCardCount ?? 0} token card{(c.tokenCardCount ?? 0) === 1 ? "" : "s"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
