"use client"

// 3D "holo foil" card for the deck presenter spotlight.
//
// Renders the card image on a tilting WebGL plane with an iridescent foil
// shader (glare streak + rainbow bands) that follows the pointer. GSAP
// smooths the tilt and plays a light-sweep entrance whenever the card
// changes. A plain <img> always renders underneath, so if WebGL or the
// cross-origin texture load fails the card still displays.

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
  WebGLRenderer,
} from "three"
import gsap from "gsap"

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
  uniform vec2 uPointer;  // -1..1, y up
  uniform float uHover;   // 0 = idle shimmer, 1 = full foil
  varying vec2 vUv;

  void main() {
    // Rounded-corner alpha mask, computed in physical card space (63x88mm).
    vec2 p = (vUv - 0.5) * vec2(${CARD_W}.0, ${CARD_H}.0);
    vec2 hsize = vec2(${(CARD_W / 2).toFixed(1)}, ${(CARD_H / 2).toFixed(1)}) - 2.8;
    vec2 q = abs(p) - hsize;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 2.8;
    float mask = 1.0 - smoothstep(-0.35, 0.35, d);
    if (mask <= 0.001) discard;

    vec3 tex = texture2D(uMap, vUv).rgb;
    float lum = dot(tex, vec3(0.299, 0.587, 0.114));

    vec2 pUv = uPointer * 0.5 + 0.5;

    // Diagonal glare band centred on the pointer.
    vec2 dir = normalize(vec2(0.8, -0.6));
    float band = dot(vUv - pUv, dir);
    float glare = exp(-band * band * 22.0);

    // Iridescent rainbow that slides as the pointer moves.
    float phase = (vUv.x * 3.0 - vUv.y * 2.2) + (uPointer.x - uPointer.y) * 1.6;
    vec3 rainbow = 0.5 + 0.5 * cos(6.2831853 * (phase + vec3(0.0, 0.33, 0.67)));

    // Foil reads stronger on bright art; always keep a subtle idle shimmer.
    float foilMask = 0.35 + 0.65 * smoothstep(0.15, 0.85, lum);
    float strength = 0.30 + 0.70 * uHover;

    vec3 color = tex;
    color += rainbow * glare * 0.50 * foilMask * strength;
    color += vec3(1.0) * glare * 0.20 * strength;

    gl_FragColor = vec4(color, mask);
  }
`

interface SceneState {
  renderer: WebGLRenderer
  uniforms: { uMap: { value: Texture | null }; uPointer: { value: Vector2 }; uHover: { value: number } }
  mesh: Mesh
  // Tilt/glare target driven by GSAP; the rAF loop blends in idle wander.
  pt: { x: number; y: number; hover: number }
  toX: (v: number) => void
  toY: (v: number) => void
  toHover: (v: number) => void
  reducedMotion: boolean
}

export default function HoloCard3D({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<SceneState | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

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

  // Texture swap on card change (arrow-key navigation reuses the renderer).
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
