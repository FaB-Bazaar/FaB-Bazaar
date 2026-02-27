"use client"

import React from "react"
import TestBinderGroup from "./TestBinderGroup"

interface TestBinderGroupedGridProps {
  groups: any[]; 
}

export default function TestBinderGroupedGrid({ groups }: TestBinderGroupedGridProps) {
  if (!groups || groups.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">This binder is empty.</h3>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {groups.map((group) => (
        <TestBinderGroup key={group.printingId} group={group} />
      ))}
    </div>
  );
}