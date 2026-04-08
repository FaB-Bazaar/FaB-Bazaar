// components/shared/FoilCardImage.tsx
// Shared foil-shimmer card image wrapper.
// Handles spring physics, idle wobble, pointer events, and the
// card__translater/rotator/front/shine/glare CSS structure.
// Only activates for Rainbow Foil ('R'/'r') and Cold Foil ('C'/'c').

"use client"

import React, { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

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

// ─────────────────────────────────────────────────────────────────────────────

interface FoilCardImageProps {
  /** Raw foiling code from the database ('R', 'C', 'S', 'G', etc.) */
  foiling?: string
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
}

export default function FoilCardImage({
  foiling,
  src,
  alt,
  className,
  imgClassName,
  onClick,
  style,
  onError,
}: FoilCardImageProps) {
  const foilingUpper = foiling?.toUpperCase()
  const isFoilCard  = foilingUpper === 'R' || foilingUpper === 'C'
  const foilRarity  = foilingUpper === 'R' ? 'rainbow foil' : 'cold foil'

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

  useEffect(() => {
    if (!isFoilCard) return
    // Touch devices: CSS already hides the effect; skip the rAF loop too
    if (window.matchMedia('(hover: none)').matches) return
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

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [isFoilCard])

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFoilCard) return
    interacting.current = true
    const s    = springsRef.current
    const rect = e.currentTarget.getBoundingClientRect()
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

  return (
    <div
      ref={cardRef}
      className={cn("card", className)}
      data-rarity={isFoilCard ? foilRarity : undefined}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
    >
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
        </div>
      </div>
    </div>
  )
}
