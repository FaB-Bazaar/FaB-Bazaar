"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { getOrderedSets } from '@/lib/fab-constants'
import { getSetImageUrl } from "@/lib/set-images"
import { useState } from "react"

export default function SetsLandingPage() {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Get sets grouped by category in display order
  const { standard, nonStandard } = getOrderedSets();

  // Reverse standard sets for display (newest first on sets page)
  const standardSets = [...standard].reverse();

  const nonStandardSets = nonStandard;

  const handleImageError = (setCode: string) => {
    setImageErrors(prev => ({ ...prev, [setCode]: true }));
  };

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>

        {/* Standard Sets */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Standard Sets</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {standardSets.map((set) => (
              set && (
                <Link
                  key={set.code}
                  href={`/sets/${set.code}`}
                  className="group block bg-white dark:bg-[#0f172a] rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-gray-300 dark:border-gray-700"
                >
                  {/* Set Image */}
                  <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center p-3">
                    {!imageErrors[set.code] ? (
                      <img
                        src={getSetImageUrl(set.code)}
                        alt={set.name}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        onError={() => handleImageError(set.code)}
                      />
                    ) : (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                          {set.code.toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Set Info */}
                  <div className="p-2 text-center">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {set.name}
                    </h3>
                  </div>
                </Link>
              )
            ))}
          </div>
        </div>

        {/* Non-Standard Sets */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Non-Standard Sets</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {nonStandardSets.map((set) => (
              set && (
                <Link
                  key={set.code}
                  href={`/sets/${set.code}`}
                  className="group block bg-white dark:bg-[#0f172a] rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-gray-300 dark:border-gray-700"
                >
                  {/* Set Image */}
                  <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center p-3">
                    {!imageErrors[set.code] ? (
                      <img
                        src={getSetImageUrl(set.code)}
                        alt={set.name}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        onError={() => handleImageError(set.code)}
                      />
                    ) : (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                          {set.code.toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Set Info */}
                  <div className="p-2 text-center">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {set.name}
                    </h3>
                  </div>
                </Link>
              )
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
