// components/shared/FoilCardImage.tsx
// Shared foil-shimmer card image wrapper.
// Handles spring physics, idle wobble, pointer events, and the
// card__translater/rotator/front/shine/glare CSS structure.
// Only activates foil shimmer for Rainbow Foil ('R'/'r') and Cold Foil ('C'/'c').
// Click-to-flip popover works for ALL cards when `expandable` is true.

"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { getFoilType, resolveFoilInset, type FoilInset } from "@/lib/foil"

// Re-exported for backward compatibility — the policy now lives in lib/foil.
export { getInsetFromArtStyle } from "@/lib/foil"
export type { FoilInset } from "@/lib/foil"

// ─── Spring physics (inline — no deps) ───────────────────────────────────────

type Spring = {
  current: number
  target: number
  velocity: number
  stiffness: number
  damping: number
}

function makeSpring(initial: number, stiffness = 0.066, damping = 0.25): Spring {
  return { current: initial, target: initial, velocity: 0, stiffness, damping }
}

function tickSpring(s: Spring) {
  const force = (s.target - s.current) * s.stiffness
  s.velocity  = (s.velocity + force) * (1 - s.damping)
  s.current  += s.velocity
}

function springSettled(s: Spring) {
  return Math.abs(s.velocity) < 0.05 && Math.abs(s.target - s.current) < 0.05
}

// ─────────────────────────────────────────────────────────────────────────────

interface FoilCardImageProps {
  /** Raw foiling code from the database ('R', 'C', 'S', 'G', etc.) */
  foiling?: string
  /**
   * Art layout variant — controls how much of the card the shine is clipped to.
   * Used as fallback when foilInset is not provided or incomplete.
   * 'extended-art' | 'alternate-art' | 'alternate-border' | 'full-art'
   */
  artStyle?: string[]
  /**
   * DB-stored foil inset values. When provided and non-null, these take
   * precedence over artStyle-derived defaults.
   */
  foilInset?: FoilInset | null
  /** Card image src URL */
  src: string
  alt: string
  /** Extra classes on the outer wrapper div (sizing, cursor, etc.) */
  className?: string
  /** Extra classes on the <img> element */
  imgClassName?: string
  /** Called when the image itself is clicked */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  style?: React.CSSProperties
  onError?: React.ReactEventHandler<HTMLImageElement>
  /** Enable click-to-flip popover animation (card flies to center, flips showing back) */
  expandable?: boolean
}

export default function FoilCardImage({
  foiling,
  artStyle,
  foilInset,
  src,
  alt,
  className,
  imgClassName,
  onClick,
  style,
  onError,
  expandable = false,
}: FoilCardImageProps) {

  const foilType = getFoilType(foiling)
  const isFoilCard = foilType !== 'none'
  const isRainbowFoil = foilType === 'rainbow'
  const foilRarity = isRainbowFoil ? 'rainbow foil' : 'cold foil'

  const cardRef     = useRef<HTMLDivElement>(null)
  const rafRef      = useRef<number | null>(null)
  const interacting = useRef(false)
  const phaseRef    = useRef(Math.random() * Math.PI * 2)
  const springsRef  = useRef({
    rotX:   makeSpring(0),
    rotY:   makeSpring(0),
    glareX: makeSpring(50),
    glareY: makeSpring(50),
    glareO: makeSpring(0),
    bgX:    makeSpring(50),
    bgY:    makeSpring(50),
  })

  // Resolve foil inset: prefer DB values, fall back to artStyle-derived defaults
  const resolvedInset = isRainbowFoil ? resolveFoilInset(foilInset, artStyle) : null

  // CSS custom properties for the foil clip-path (written to the card element style)
  const foilInsetVars: React.CSSProperties = resolvedInset
    ? {
        ['--foil-inset-top' as string]:    `${resolvedInset.top}%`,
        ['--foil-inset-right' as string]:  `${resolvedInset.right}%`,
        ['--foil-inset-bottom' as string]: `${resolvedInset.bottom}%`,
        ['--foil-inset-left' as string]:   `${resolvedInset.left}%`,
        ['--foil-inset-round' as string]:  resolvedInset.round,
      }
    : {}

  // ─── Popover / flip state ──────────────────────────────────────────────
  const [active, setActive] = useState(false)
  const portalRef      = useRef<HTMLDivElement>(null)
  const popoverRafRef  = useRef<number | null>(null)
  const origRectRef    = useRef<DOMRect | null>(null)
  const popoverSprings = useRef({
    tx:    makeSpring(0, 0.065, 0.68),
    ty:    makeSpring(0, 0.065, 0.68),
    scale: makeSpring(1, 0.065, 0.68),
    flip:  makeSpring(0, 0.045, 0.42),
  })

  // ─── Foil shimmer rAF loop (unchanged from original) ────────────────────
  useEffect(() => {
    if (!isFoilCard) return
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) return
    const el = cardRef.current
    if (!el) return

    let r = phaseRef.current

    const loop = () => {
      const s = springsRef.current

      if (!interacting.current) {
        r += 0.006
        s.rotX.target   = Math.sin(r) * 12
        s.rotY.target   = Math.cos(r * 0.71) * 10
        s.glareX.target = 50 + Math.sin(r * 0.83) * 35
        s.glareY.target = 50 + Math.cos(r * 1.13) * 30
        s.glareO.target = 0.7
        s.bgX.target    = 50 + Math.sin(r) * 18
        s.bgY.target    = 50 + Math.cos(r * 0.71) * 14
        Object.values(s).forEach(sp => { sp.stiffness = 0.015; sp.damping = 0.40 })
      }

      Object.values(s).forEach(tickSpring)

      const fromLeft   = s.glareX.current / 100
      const fromTop    = s.glareY.current / 100
      const fromCenter = Math.min(
        Math.sqrt((s.glareY.current - 50) ** 2 + (s.glareX.current - 50) ** 2) / 50,
        1
      )

      // Write foil CSS vars to inline card
      el.style.setProperty('--rotate-x',            `${s.rotX.current}deg`)
      el.style.setProperty('--rotate-y',            `${s.rotY.current}deg`)
      el.style.setProperty('--pointer-x',           `${s.glareX.current}%`)
      el.style.setProperty('--pointer-y',           `${s.glareY.current}%`)
      el.style.setProperty('--pointer-from-center', String(fromCenter))
      el.style.setProperty('--pointer-from-left',   String(fromLeft))
      el.style.setProperty('--pointer-from-top',    String(fromTop))
      el.style.setProperty('--card-opacity',        String(s.glareO.current))
      el.style.setProperty('--background-x',        `${s.bgX.current}%`)
      el.style.setProperty('--background-y',        `${s.bgY.current}%`)

      // Mirror foil vars to portal clone so shimmer persists when expanded
      const portal = portalRef.current
      if (portal) {
        portal.style.setProperty('--rotate-x',            `${s.rotX.current}deg`)
        portal.style.setProperty('--rotate-y',            `${s.rotY.current}deg`)
        portal.style.setProperty('--pointer-x',           `${s.glareX.current}%`)
        portal.style.setProperty('--pointer-y',           `${s.glareY.current}%`)
        portal.style.setProperty('--pointer-from-center', String(fromCenter))
        portal.style.setProperty('--pointer-from-left',   String(fromLeft))
        portal.style.setProperty('--pointer-from-top',    String(fromTop))
        portal.style.setProperty('--card-opacity',        String(s.glareO.current))
        portal.style.setProperty('--background-x',        `${s.bgX.current}%`)
        portal.style.setProperty('--background-y',        `${s.bgY.current}%`)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [isFoilCard])

  // ─── Popover rAF loop (translate + scale + flip on the portal element) ──
  const runPopoverLoop = useCallback(() => {
    const el = portalRef.current
    if (!el) return
    const s = popoverSprings.current
    Object.values(s).forEach(tickSpring)

    el.style.setProperty('--translate-x', `${s.tx.current}px`)
    el.style.setProperty('--translate-y', `${s.ty.current}px`)
    el.style.setProperty('--card-scale',  String(s.scale.current))
    el.style.setProperty('--flip-deg',    `${s.flip.current}deg`)

    const settled = Object.values(s).every(springSettled)
    if (settled) {
      popoverRafRef.current = null
      return
    }
    popoverRafRef.current = requestAnimationFrame(runPopoverLoop)
  }, [])

  const startPopoverLoop = useCallback(() => {
    if (popoverRafRef.current === null) {
      popoverRafRef.current = requestAnimationFrame(runPopoverLoop)
    }
  }, [runPopoverLoop])

  // Cleanup popover loop on unmount
  useEffect(() => {
    return () => { if (popoverRafRef.current !== null) cancelAnimationFrame(popoverRafRef.current) }
  }, [])

  // When portal mounts, start the popover animation
  useEffect(() => {
    if (!active || !portalRef.current || !origRectRef.current) return
    const rect = origRectRef.current
    const el = portalRef.current
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const s = popoverSprings.current

    // Pin portal card at the original card's viewport position
    el.style.top    = `${rect.top}px`
    el.style.left   = `${rect.left}px`
    el.style.width  = `${rect.width}px`
    el.style.height = `${rect.height}px`

    // Reset springs to origin
    s.tx.current = 0; s.tx.velocity = 0
    s.ty.current = 0; s.ty.velocity = 0
    s.scale.current = 1; s.scale.velocity = 0
    s.flip.current = 0; s.flip.velocity = 0

    // Translate from pinned position to viewport center
    s.tx.target = Math.round(vw / 2 - rect.left - rect.width / 2)
    s.ty.target = Math.round(vh / 2 - rect.top - rect.height / 2)

    // Scale up
    const scaleW = (vw / rect.width) * 0.85
    const scaleH = (vh / rect.height) * 0.85
    s.scale.target = Math.min(scaleW, scaleH, 1.75)

    // Gentle entrance spring
    s.tx.stiffness = 0.065; s.tx.damping = 0.68
    s.ty.stiffness = 0.065; s.ty.damping = 0.68
    s.scale.stiffness = 0.065; s.scale.damping = 0.68

    // 360° Y-axis flip to show card back
    s.flip.target = 360
    s.flip.stiffness = 0.045; s.flip.damping = 0.42

    // After the flip settles, snap rotation back to 0
    setTimeout(() => {
      s.flip.stiffness = 0.3; s.flip.damping = 0.7
      s.flip.target = 0
      startPopoverLoop()
    }, 1200)

    startPopoverLoop()
  }, [active, startPopoverLoop])

  const deactivate = useCallback(() => {
    setActive(false)
    origRectRef.current = null
    // Reset springs for next activation
    const s = popoverSprings.current
    s.tx.current = 0; s.tx.target = 0; s.tx.velocity = 0
    s.ty.current = 0; s.ty.target = 0; s.ty.velocity = 0
    s.scale.current = 1; s.scale.target = 1; s.scale.velocity = 0
    s.flip.current = 0; s.flip.target = 0; s.flip.velocity = 0
    if (popoverRafRef.current !== null) {
      cancelAnimationFrame(popoverRafRef.current)
      popoverRafRef.current = null
    }
  }, [])

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // If expandable is off, just call external onClick
    if (!expandable) {
      onClick?.(e)
      return
    }

    e.stopPropagation()
    const el = cardRef.current
    if (!el) return

    // Capture rect before activating portal
    origRectRef.current = el.getBoundingClientRect()
    setActive(true)

    onClick?.(e)
  }, [expandable, onClick])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deactivate()
  }, [deactivate])

  // Close on Escape
  useEffect(() => {
    if (!active) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') deactivate()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [active, deactivate])

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFoilCard) return
    interacting.current = true
    const s    = springsRef.current

    // For the portal card, getBoundingClientRect() returns the pre-transform rect.
    // We need the visual rect accounting for translate + scale from the popover springs.
    let rect = e.currentTarget.getBoundingClientRect()
    if (active && portalRef.current && e.currentTarget === portalRef.current) {
      const ps = popoverSprings.current
      const scale = ps.scale.current
      const w = rect.width * scale
      const h = rect.height * scale
      const cx = rect.left + rect.width / 2 + ps.tx.current
      const cy = rect.top + rect.height / 2 + ps.ty.current
      rect = { left: cx - w / 2, top: cy - h / 2, width: w, height: h } as DOMRect
    }

    const px   = Math.min(100, Math.max(0, (100 / rect.width)  * (e.clientX - rect.left)))
    const py   = Math.min(100, Math.max(0, (100 / rect.height) * (e.clientY - rect.top)))
    const cx   = px - 50
    const cy   = py - 50
    Object.values(s).forEach(sp => { sp.stiffness = 0.066; sp.damping = 0.25 })
    s.rotX.target   = -(cx / 3.5)
    s.rotY.target   =   cy / 3.5
    s.glareX.target = px
    s.glareY.target = py
    s.glareO.target = 1
    s.bgX.target    = 37 + (px / 100) * 26
    s.bgY.target    = 33 + (py / 100) * 34
  }

  const handlePointerLeave = () => {
    if (!isFoilCard) return
    interacting.current = false
    const s = springsRef.current
    Object.values(s).forEach(sp => { sp.stiffness = 0.01; sp.damping = 0.06 })
    s.rotX.target = 0;  s.rotY.target = 0
    s.glareX.target = 50; s.glareY.target = 50; s.glareO.target = 0
    s.bgX.target = 50; s.bgY.target = 50
  }

  // Shared card content (used in both inline card and portal card)
  const cardContent = (
    <div className="card__translater w-full h-full">
      <div className="card__rotator w-full h-full">
        <div className={cn("card__front w-full h-full", !isFoilCard && "flex items-center justify-center")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={imgClassName}
            loading="lazy"
            draggable={false}
            onError={onError}
          />
          {isFoilCard && (
            <>
              <div className="card__shine" />
              <div className="card__glare" />
            </>
          )}
        </div>
        {expandable && (
          <div className="card__back">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cardback.webp"
              alt=""
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div
        ref={cardRef}
        className={cn("card", expandable && "cursor-pointer", className)}
        data-rarity={isFoilCard ? foilRarity : undefined}
        style={{ ...foilInsetVars, ...style }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleCardClick}
      >
        {cardContent}
      </div>

      {/* Portal: backdrop + animated card clone — rendered on document.body to escape any stacking context */}
      {active && typeof document !== 'undefined' && createPortal(
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="card-popover-backdrop" onClick={handleBackdropClick} />
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            ref={portalRef}
            className={cn("card card-popover-active")}
            data-rarity={isFoilCard ? foilRarity : undefined}
            style={foilInsetVars}
            data-active
            onClick={e => e.stopPropagation()}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            {cardContent}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
