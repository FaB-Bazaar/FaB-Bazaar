"use client"

import { useEffect } from "react"
import { installPinchPanGuard } from "@/lib/utils/pinch-pan-guard"

/**
 * Global listener that keeps pinch-zoom panning working while a scroll-locked
 * overlay (Radix dialog/sheet) is open. See lib/utils/pinch-pan-guard.ts.
 */
export function PinchZoomPanGuard() {
  useEffect(() => installPinchPanGuard(window), [])
  return null
}
