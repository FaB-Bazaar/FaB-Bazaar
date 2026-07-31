// components/deck/DrawingOverlay.tsx
// Freehand "whiteboard" overlay for the deck presenter. A transparent, full-
// viewport canvas that the presenter can draw on with the mouse/pen while
// streaming or doing a decktech. Layered above the spotlight (z-40) so it
// annotates both the fit-view grid and a spotlighted card, but below the top
// nav pills (z-[60]) so those stay clickable.
//
// When the pen is off the canvas is `pointer-events: none`, so the page behaves
// exactly as it does without the overlay.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pencil, Undo2, Trash2 } from "lucide-react"
import { startStroke, extendStroke, undo as undoStrokes, type Stroke } from "@/lib/drawing/strokes"

const STROKE_COLOR = "#fde047" // amber-300 — high-contrast on dark bg and card art
const STROKE_WIDTH = 6
// Dark casing painted under the color pass (route-on-a-map style) so strokes
// stay legible over bright, busy card art instead of blending into it.
const CASING_COLOR = "#1e293b" // slate-800
const CASING_EXTRA = 5 // total extra width → ~2.5px outline each side

export default function DrawingOverlay({ available }: { available: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [penMode, setPenMode] = useState(false)
  // Committed strokes live in state (drives undo/clear button enablement);
  // the in-progress stroke lives in a ref so pointermove doesn't re-render.
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef<Stroke | null>(null)

  strokesRef.current = strokes

  // Pen is only usable while the tool is available (fit view or spotlight open).
  useEffect(() => {
    if (!available) setPenMode(false)
  }, [available])

  // Draw a single stroke onto the 2D context: a wider dark casing pass first,
  // then the color pass on top. Two passes per stroke (not per segment) so a
  // self-crossing stroke keeps its casing under, not over, its own color.
  const paintStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length === 0) return
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    const passes: Array<{ color: string; width: number }> = [
      { color: CASING_COLOR, width: s.width + CASING_EXTRA },
      { color: s.color, width: s.width },
    ]
    for (const pass of passes) {
      ctx.strokeStyle = pass.color
      ctx.fillStyle = pass.color
      ctx.lineWidth = pass.width
      if (s.points.length === 1) {
        // A click without drag → a dot.
        const p = s.points[0]
        ctx.beginPath()
        ctx.arc(p.x, p.y, pass.width / 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      ctx.stroke()
    }
  }, [])

  // Full repaint — used on resize, undo, clear, and after each completed stroke.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    for (const s of strokesRef.current) paintStroke(ctx, s)
    if (drawingRef.current) paintStroke(ctx, drawingRef.current)
  }, [paintStroke])

  // Size the canvas backing store to the viewport × devicePixelRatio so lines
  // stay crisp, then repaint. Re-runs on viewport resize / DPR change.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      redraw()
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
    // `available` is a dep so the canvas is re-sized when the overlay returns to
    // the DOM (e.g. scroll view → fit view). Without it the effect keeps a stale
    // reference to the old, detached canvas and the new one is never sized.
  }, [redraw, available])

  // Repaint committed strokes whenever they change (undo / clear).
  useEffect(() => { redraw() }, [strokes, redraw])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!penMode) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = startStroke(STROKE_COLOR, STROKE_WIDTH, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
    redraw()
  }, [penMode, redraw])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!penMode || !drawingRef.current) return
    drawingRef.current = extendStroke(drawingRef.current, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
    redraw()
  }, [penMode, redraw])

  const endStroke = useCallback(() => {
    const s = drawingRef.current
    drawingRef.current = null
    if (s) setStrokes(prev => [...prev, s])
  }, [])

  // Keyboard shortcuts: D toggles the pen, U undoes the last stroke, C clears.
  // Active only while the tool is available; ignored while typing in a field or
  // when a modifier is held (so browser/page chords aren't hijacked).
  useEffect(() => {
    if (!available) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      switch (e.key.toLowerCase()) {
        case "d": e.preventDefault(); setPenMode(m => !m); break
        case "u": e.preventDefault(); setStrokes(undoStrokes); break
        case "c": e.preventDefault(); setStrokes([]); break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [available])

  if (!available) return null

  return (
    <>
      <canvas
        ref={canvasRef}
        data-testid="presenter-draw-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        className="fixed inset-0 z-[55]"
        style={{ pointerEvents: penMode ? "auto" : "none", cursor: penMode ? "crosshair" : "default", touchAction: "none" }}
      />

      {/* Minimal toolbar — pen toggle, undo, clear. Top-center, between the
          "Back to editor" and "Scroll view" pills. */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1.5 rounded-full bg-gray-900/90 border border-gray-600 backdrop-blur-md shadow-xl p-1.5">
        <button
          type="button"
          onClick={() => setPenMode(m => !m)}
          aria-pressed={penMode}
          title={penMode ? "Disable drawing (D)" : "Draw over the deck (D)"}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            penMode
              ? "bg-amber-400 text-gray-900 hover:bg-amber-300"
              : "text-gray-200 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <Pencil className="h-4 w-4" />
          {penMode ? "Drawing" : "Draw"}
        </button>
        {penMode && (
          <>
            <button
              type="button"
              onClick={() => setStrokes(undoStrokes)}
              disabled={strokes.length === 0}
              title="Undo last stroke (U)"
              className="flex items-center justify-center w-9 h-9 rounded-full text-gray-200 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              title="Clear all (C)"
              className="flex items-center justify-center w-9 h-9 rounded-full text-gray-200 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </>
  )
}
