"use client"

import React, { useEffect, useState } from "react"

/**
 * An <img> for card art that survives a dropped request. Views that swap in
 * dozens of cards at once (deck page Brew → Cards) occasionally lost a load
 * and kept a broken-image icon + alt text until a refresh. This retries once
 * with a cache-busting query (the Cloudflare `/public` variant ignores it),
 * then hands over to the caller's onError, or falls back to the cardback.
 * Resets whenever `src` changes.
 */
export default function RetryingImg({ src, onError, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { setAttempt(0) }, [src])
  const url = typeof src === "string" ? src : undefined
  const displaySrc = attempt === 0 || !url ? src
    : attempt === 1 ? `${url}${url.includes("?") ? "&" : "?"}retry=1`
    : "/cardback.webp"
  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    if (attempt === 0 && url) { setAttempt(1); return }
    if (attempt === 1) {
      if (onError) { onError(e); return }
      setAttempt(2)
    }
  }
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} src={displaySrc} onError={handleError} />
}
