"use client"

import React from "react"
import TestBinderInstanceCard from "./TestBinderInstanceCard"

// This grid displays a flattened list of "enriched" instances.
interface TestBinderGridProps {
  instances: any[]; // An array of card instances, each enriched with its group data
}

export default function TestBinderGrid({ instances }: TestBinderGridProps) {
  if (!instances || instances.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">No cards to display.</h3>
        <p className="text-gray-500">This binder is empty.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
      {instances.map((instance) => (
        <TestBinderInstanceCard key={instance._id} instance={instance} />
      ))}
    </div>
  )
}