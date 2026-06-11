"use client"

// 3D "holo foil" card for the deck presenter spotlight.
//
// Renders the card image on a tilting WebGL plane with a foil shader that
// mirrors the platform's CSS foil model (see app/foil-cards.css and
// components/shared/FoilCardImage.tsx):
//   - Rainbow Foil ('R'): crossing spectrum gratings, CLIPPED to the foil
//     inset region (DB foil_inset_* values, artStyle-derived fallback)
//   - Cold Foil ('C'): cool teal/blue gratings across the FULL card
//   - anything else: glossy tilt + neutral glare, no iridescence
// GSAP smooths the tilt and plays a light-sweep entrance on card change.
// A plain <img> always renders underneath, so if WebGL or the cross-origin
// texture load fails the card still displays.

import React, { useEffect, useRef, useState } from "react"
import {
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector4,
  WebGLRenderer,
} from "three"
import gsap from "gsap"
import { getInsetFromArtStyle, type FoilInset } from "@/components/shared/FoilCardImage"

const CARD_W = 63
const CARD_H = 88

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uPointer;     // -1..1, y up
  uniform float uHover;      // 0 = idle shimmer, 1 = full foil
  uniform float uFoilType;   // 0 none, 1 rainbow, 2 cold
  uniform vec4 uInset;       // rainbow foil region: top, right, bottom, left (0..1)
  uniform float uInsetRound; // foil region corner radius, card-mm space
  varying vec2 vUv;

  float roundedRectSDF(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - (halfSize - r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  vec3 spectrum(float t) {
    return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    // Rounded-corner card mask in physical card space (63x88mm).
    vec2 p = (vUv - 0.5) * vec2(${CARD_W}.0, ${CARD_H}.0);
    float dCard = roundedRectSDF(p, vec2(${(CARD_W / 2).toFixed(1)}, ${(CARD_H / 2).toFixed(1)}), 2.8);
    float mask = 1.0 - smoothstep(-0.35, 0.35, dCard);
    if (mask <= 0.001) discard;

    vec3 color = texture2D(uMap, vUv).rgb;
    vec2 pUv = uPointer * 0.5 + 0.5;

    // Light spotlight around the pointer (shared by all foil types).
    float dGlare = distance(vUv, pUv);
    float spotlight = exp(-dGlare * dGlare * 6.0);
    float strength = 0.30 + 0.70 * uHover;

    if (uFoilType > 1.5) {
      // ── Cold foil: cool teal/blue crossing gratings, full card ──
      // (CSS reference: 133deg / -47deg repeating gradients, color-dodge)
      float t1 = dot(vUv, vec2(cos(2.32), sin(2.32))) * 4.5 + (uPointer.x + uPointer.y) * 0.8;
      float t2 = dot(vUv, vec2(cos(-0.82), sin(-0.82))) * 3.5 + (uPointer.x - uPointer.y) * 0.9;
      float g1 = pow(0.5 + 0.5 * sin(t1 * 6.2831853), 2.5);
      float g2 = pow(0.5 + 0.5 * sin(t2 * 6.2831853), 2.5);
      // teal <-> blue-violet hue drift along the stripes
      vec3 cool = mix(vec3(0.30, 0.80, 0.86), vec3(0.45, 0.55, 0.95), 0.5 + 0.5 * sin(t1 * 2.0 + t2));
      vec3 shine = cool * (g1 * 0.60 + g2 * 0.45);
      // color-dodge concentrates the metallic pop on dark art/border pixels
      float dodgeAmt = (0.40 + 0.60 * spotlight) * strength;
      color = min(color / max(vec3(1.0) - shine * dodgeAmt, vec3(0.30)), vec3(1.5));
      // cool-tinted glare
      color += vec3(0.75, 0.90, 1.0) * spotlight * 0.28 * strength;
    } else if (uFoilType > 0.5) {
      // ── Rainbow foil: spectrum gratings clipped to the foil inset region ──
      vec2 lo = vec2(uInset.w, uInset.z);             // left, bottom (uv space, y up)
      vec2 hi = vec2(1.0 - uInset.y, 1.0 - uInset.x); // right, top
      vec2 c = (lo + hi) * 0.5;
      vec2 hs = (hi - lo) * 0.5 * vec2(${CARD_W}.0, ${CARD_H}.0);
      vec2 pr = (vUv - c) * vec2(${CARD_W}.0, ${CARD_H}.0);
      float dFoil = roundedRectSDF(pr, hs, uInsetRound);
      float foilRegion = 1.0 - smoothstep(-0.3, 0.3, dFoil);

      if (foilRegion > 0.001) {
        // main spectrum grating (~-22deg), pans with pointer Y
        float t1 = dot(vUv, vec2(cos(-0.384), sin(-0.384))) * 2.2 - uPointer.y * 0.9;
        // crossing grating (~68deg), pans with pointer X
        float t2 = dot(vUv, vec2(cos(1.187), sin(1.187))) * 1.8 + uPointer.x * 0.8;
        vec3 shine = spectrum(t1) * 0.55 + spectrum(t2 + 0.45) * 0.35;
        float bright = (0.35 + 0.65 * spotlight) * strength;
        vec3 dodged = min(color / max(vec3(1.0) - shine * bright * 0.85, vec3(0.30)), vec3(1.5));
        color = mix(color, dodged, foilRegion);
      }
      // broad diffuse white glare across the whole card
      color += vec3(1.0) * spotlight * 0.18 * strength;
    } else {
      // ── Non-foil: glossy card, neutral glare only ──
      color += vec3(1.0) * spotlight * 0.15 * (0.2 + 0.8 * uHover);
    }

    gl_FragColor = vec4(color, mask);
  }
`

interface SceneState {
  renderer: WebGLRenderer
  uniforms: {
    uMap: { value: Texture | null }
    uPointer: { value: Vector2 }
    uHover: { value: number }
    uFoilType: { value: number }
    uInset: { value: Vector4 }
    uInsetRound: { value: number }
  }
  mesh: Mesh
  // Tilt/glare target driven by GSAP; the rAF loop blends in idle wander.
  pt: { x: number; y: number; hover: number }
  toX: (v: number) => void
  toY: (v: number) => void
  toHover: (v: number) => void
  reducedMotion: boolean
}

/** Foil region corner radius ("1.5%", "8px", null) → card-mm space. */
function parseRoundMm(round: string | null | undefined): number {
  const fallback = 0.015 * CARD_W
  if (!round) return fallback
  const v = parseFloat(round)
  if (Number.isNaN(v)) return fallback
  // px values were authored against ~420px-wide rendered cards
  if (round.includes("px")) return (v / 420) * CARD_W
  return (v / 100) * CARD_W
}

interface HoloCard3DProps {
  src: string
  alt: string
  className?: string
  /** Raw foiling code from the database ('R', 'C', 'S', ...) */
  foiling?: string
  /** Art layout variants — fallback for the foil region when no DB inset exists */
  artStyle?: string[]
  /** DB-stored foil inset values (percentages 0-100); takes precedence over artStyle */
  foilInset?: FoilInset | null
}

export default function HoloCard3D({ src, alt, className = "", foiling, artStyle, foilInset }: HoloCard3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<SceneState | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const foilingUpper = foiling?.toUpperCase()
  const foilType = foilingUpper === "R" ? 1 : foilingUpper === "C" ? 2 : 0

  // Same resolution rules as FoilCardImage: DB values win, artStyle fills gaps.
  const fallbackInset = getInsetFromArtStyle(artStyle)
  const top = foilInset?.top ?? fallbackInset.top
  const right = foilInset?.right ?? fallbackInset.right
  const bottom = foilInset?.bottom ?? fallbackInset.bottom
  const left = foilInset?.left ?? fallbackInset.left
  const roundMm = parseRoundMm(foilInset?.round ?? fallbackInset.round)

  // Mount: renderer, scene, shader plane, pointer handlers, render loop.
  useEffect(() => {
    const el = containerRef.current
    const wrap = canvasWrapRef.current
    if (!el || !wrap) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.className = "absolute inset-0 w-full h-full"
    wrap.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(32, CARD_W / CARD_H, 0.1, 20)
    camera.position.z = 4.25

    const uniforms = {
      uMap: { value: null as Texture | null },
      uPointer: { value: new Vector2(0, 0) },
      uHover: { value: 0 },
      uFoilType: { value: 0 },
      uInset: { value: new Vector4(0, 0, 0, 0) },
      uInsetRound: { value: 0 },
    }
    const geometry = new PlaneGeometry(2 * (CARD_W / CARD_H), 2)
    const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true })
    const mesh = new Mesh(geometry, material)
    scene.add(mesh)

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const pt = { x: 0, y: 0, hover: 0 }
    const toX = gsap.quickTo(pt, "x", { duration: 0.5, ease: "power3.out" })
    const toY = gsap.quickTo(pt, "y", { duration: 0.5, ease: "power3.out" })
    const toHover = gsap.quickTo(pt, "hover", { duration: 0.6, ease: "power2.out" })
    sceneRef.current = { renderer, uniforms, mesh, pt, toX, toY, toHover, reducedMotion }

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const pointTo = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      toX(((e.clientX - r.left) / r.width) * 2 - 1)
      toY(-(((e.clientY - r.top) / r.height) * 2 - 1))
      toHover(1)
    }
    const release = () => {
      toX(0)
      toY(0)
      toHover(0)
    }
    el.addEventListener("pointermove", pointTo)
    el.addEventListener("pointerdown", pointTo)
    el.addEventListener("pointerleave", release)
    el.addEventListener("pointerup", release)
    el.addEventListener("pointercancel", release)

    let raf = 0
    const start = performance.now()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const t = (performance.now() - start) / 1000
      // Idle wander keeps the foil alive when nobody is hovering.
      const idle = reducedMotion ? 0 : 1 - Math.min(1, pt.hover)
      const px = pt.x + Math.sin(t * 0.6) * 0.55 * idle
      const py = pt.y + Math.sin(t * 0.45 + 1.7) * 0.45 * idle
      uniforms.uPointer.value.set(px, py)
      uniforms.uHover.value = pt.hover
      mesh.rotation.y = px * 0.42
      mesh.rotation.x = -py * 0.32
      const s = 1 + pt.hover * 0.03
      mesh.scale.set(s, s, 1)
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener("pointermove", pointTo)
      el.removeEventListener("pointerdown", pointTo)
      el.removeEventListener("pointerleave", release)
      el.removeEventListener("pointerup", release)
      el.removeEventListener("pointercancel", release)
      gsap.killTweensOf(pt)
      uniforms.uMap.value?.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      wrap.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [])

  // Foil parameters follow the displayed printing (arrow-key navigation).
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.uniforms.uFoilType.value = foilType
    s.uniforms.uInset.value.set(top / 100, right / 100, bottom / 100, left / 100)
    s.uniforms.uInsetRound.value = roundMm
  }, [foilType, top, right, bottom, left, roundMm])

  // Texture swap on card change (reuses the renderer).
  useEffect(() => {
    setFailed(false)
    let cancelled = false
    new TextureLoader().setCrossOrigin("anonymous").load(
      src,
      tex => {
        const s = sceneRef.current
        if (cancelled || !s) {
          tex.dispose()
          return
        }
        tex.anisotropy = s.renderer.capabilities.getMaxAnisotropy()
        s.uniforms.uMap.value?.dispose()
        s.uniforms.uMap.value = tex
        setReady(true)
        if (!s.reducedMotion) {
          // Light sweep across the new card, then settle to idle.
          gsap.fromTo(s.pt, { x: -1.3, y: 0.4, hover: 1 }, { x: 0, y: 0, hover: 0, duration: 1.2, ease: "power2.out", overwrite: "auto" })
        }
      },
      undefined,
      () => {
        if (!cancelled) setFailed(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [src])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={alt}
      className={`relative aspect-[63/88] select-none ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Fallback / loading placeholder — the canvas fades in over it. */}
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-contain rounded-[4.5%]" draggable={false} />
      {/* three's canvas is appended here by the mount effect */}
      <div
        ref={canvasWrapRef}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-500 ${ready && !failed ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  )
}
