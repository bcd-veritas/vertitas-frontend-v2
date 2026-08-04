"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  FORM,
  sceneMotion,
  INK_HEX,
  LANDING_BG,
  LANDING_BG_RESOLVED,
  NO_HEX,
  YES_HEX,
} from "./sceneMotion";

import { WORLD_HALF_H as HALF_H } from "./sceneMotion";

const vec3 = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

/**
 * All 8 formations live in the vertex shader; the CPU only writes uniforms.
 * `position` holds each particle's spot ON THE COIN (rim / face / $ glyph) —
 * the coin doubles as the geometry's real attribute so bounding info exists.
 */
const vertexShader = /* glsl */ `
  attribute vec4 aSeed;
  attribute float aKind; // 0 face (dim), 1 rim (bright), 2 glyph (brightest)
  attribute vec3 aYes;  // spot on the giant pixel "YES" (verdict form)
  attribute vec3 aNumB; // loader numeral target ("100" — JS fills once)
  uniform float uTime, uHalfW, uHalfH, uCoinR, uFormA, uFormB, uMix, uSpin,
                uRise, uTint, uDamp, uAlpha, uTurb, uPx, uExposure, uSweep,
                uTiltX, uDissolve, uKindLag;

  varying vec3 vColor;
  varying float vAlpha;

  const vec3 YES = ${vec3(YES_HEX)};
  const vec3 NO  = ${vec3(NO_HEX)};
  const vec3 INK = ${vec3(INK_HEX)};
  const float PI = 3.14159265;

  vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }
  vec3 rotX(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  }
  float side() { return step(0.5, aSeed.w); } // 0 = No (coral), 1 = Yes (mint)
  vec3 sideCol() { return mix(NO, YES, side()); }

  vec3 sphereDir() {
    float th = aSeed.x * 2.0 * PI;
    float ph = acos(2.0 * aSeed.z - 1.0);
    return vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
  }
  float streamX() {
    return mod(aSeed.x * 2.0 * uHalfW + uTime * 0.22 * uHalfW * (0.5 + aSeed.z),
               2.0 * uHalfW) - uHalfW;
  }
  vec3 curl(vec3 q, float t) {
    return vec3(
      sin(q.y * 3.1 + t * 0.9) + cos(q.z * 2.3 + t * 0.7),
      sin(q.z * 2.7 + t * 0.8) + cos(q.x * 3.3 + t * 0.6),
      sin(q.x * 2.1 + t * 0.5) + cos(q.y * 2.9 + t * 0.8)
    ) * 0.33;
  }

  /* ── formations ── */
  vec3 pNoise() {
    vec3 p = vec3((aSeed.x * 2.0 - 1.0) * uHalfW * 1.05,
                  (aSeed.y * 2.0 - 1.0) * uHalfH * 1.05,
                  (aSeed.z - 0.5) * 0.5);
    p.x += 0.05 * uHalfH * sin(uTime * 0.6 + aSeed.z * 40.0);
    p.y += 0.05 * uHalfH * cos(uTime * 0.8 + aSeed.x * 35.0);
    p.y -= uRise * (0.7 + aSeed.y) * uHalfH;
    return p;
  }
  vec3 pVortex() {
    // A tilted funnel spinning in the DEPTH plane (xz), not a flat ring:
    // wider at the top, tighter at the throat, tipped toward the camera so
    // perspective attenuation gives the swirl real parallax.
    float ang = aSeed.x * 2.0 * PI + uTime * (0.8 + 1.8 * (1.0 - aSeed.y));
    float h = aSeed.w - 0.5;                       // -0.5 .. 0.5 height
    float r = (0.12 + 0.95 * aSeed.y) * uHalfH
            * (0.55 + 0.9 * (h + 0.5));           // cone profile
    vec3 p = vec3(cos(ang) * r, h * uHalfH * 0.75, sin(ang) * r * 0.85);
    return rotX(p, 0.5);
  }
  vec3 pCoin(float s, vec3 off) {
    return rotX(rotY(position, uSpin), uTiltX) * uCoinR * s + off;
  }
  vec3 pStreams() {
    float s = side() * 2.0 - 1.0;
    float x = streamX();
    float y = s * 0.38 * uHalfH
            + 0.10 * uHalfH * sin(x * 2.5 / uHalfH + uTime * 0.8 + aSeed.z * 3.0) * s
            + (aSeed.y - 0.5) * 0.13 * uHalfH;
    return vec3(x, y, (aSeed.z - 0.5) * 0.1);
  }
  vec3 pRibbon() {
    float x = streamX();
    float y = uDamp * uHalfH * (0.22 * sin(x * 2.0 / uHalfH + uTime * 0.9)
                              + 0.08 * sin(x * 4.7 / uHalfH + uTime * 1.6))
            + (aSeed.y - 0.5) * 0.05 * uHalfH;
    return vec3(x, y, (aSeed.z - 0.5) * 0.06);
  }
  vec3 pPoint() {
    // The globe (WordGlobe homage): particles ride 24 twisted meridian
    // bands pole-to-pole over a 3D sphere — a spinning lattice of light.
    // Additive blending lets the far-side bands glow through, giving the
    // hologram-globe depth. uSpin carries the collapse's angular momentum
    // straight through the held beat into the coin's idle spin.
    float band = floor(aSeed.x * 24.0);
    float theta = (0.04 + 0.92 * aSeed.w) * PI;
    float phi = band * (PI / 12.0) + 1.35 * theta + 0.35 * sin(theta)
              + (aSeed.y - 0.5) * 0.05;
    float R = (0.30 + (aSeed.z - 0.5) * 0.02) * uHalfH;
    vec3 p = vec3(sin(theta) * cos(phi), cos(theta), sin(theta) * sin(phi)) * R;
    return rotX(rotY(p, uSpin), uTiltX);
  }
  vec3 pBurst() { return sphereDir() * (0.25 + 1.35 * aSeed.y) * uHalfH; }
  vec3 pMini()  { return pCoin(0.26, vec3(0.0, 0.46 * uHalfH, 0.0)); }
  vec3 pVerdict() {
    float s = uHalfW * 0.82;
    return vec3(aYes.x * s, aYes.y * s, aYes.z * 0.4);
  }
  vec3 pCount() {
    // The numeral "100": rock-solid at uDissolve 0 (registered to the DOM
    // counter it replaces), then it grains up and frays apart — each
    // particle lets go on its own clock, so edges crumble first and the
    // glyphs visibly lose cohesion instead of fading.
    float s = min(uHalfW, uHalfH) * 0.72;
    vec3 p = aNumB * s;
    float d = smoothstep(0.0, 1.0,
                         clamp((uDissolve - aSeed.w * 0.55) / 0.45, 0.0, 1.0));
    p += curl(p * (2.2 / uHalfH) + aSeed.xyz * 8.0, uTime)
         * (d * 0.45 * uHalfH);
    p.x += sin(uTime * 1.4 + aSeed.x * 30.0) * 0.04 * uHalfH * d;
    p.y += cos(uTime * 1.2 + aSeed.y * 27.0) * 0.04 * uHalfH * d;
    return rotY(p, uSpin);
  }

  vec3 formPos(float f) {
    if (f < 0.5) return pNoise();
    if (f < 1.5) return pVortex();
    if (f < 2.5) return pCoin(1.0, vec3(0.0));
    if (f < 3.5) return pStreams();
    if (f < 4.5) return pRibbon();
    if (f < 5.5) return pPoint();
    if (f < 6.5) return pBurst();
    if (f < 7.5) return pMini();
    if (f < 8.5) return pVerdict();
    return pCount();
  }

  vec3 formCol(float f, vec3 p) {
    if (f < 1.5) return mix(INK, sideCol(), uTint * 0.65);          // noise + vortex
    if (f < 2.5) return mix(INK, sideCol(), 0.22 + 0.2 * step(1.5, aKind)); // coin
    if (f < 3.5) return sideCol();                                   // streams
    if (f < 4.5) {                                                   // ribbon
      vec3 rc = mix(NO, YES, 0.5 + 0.5 * sin(p.x * 2.0 / uHalfH + uTime * 0.5));
      // Everything the resolution scanline has passed locks to mint.
      return mix(rc, YES, step(p.x, uSweep * uHalfW) * 0.85);
    }
    if (f < 5.5) return mix(YES, INK, 0.25);                         // truth point
    if (f < 6.5) return mix(YES, INK, aSeed.y * 0.55);               // burst
    if (f < 7.5) return mix(INK, YES, 0.35);                         // mini coin
    if (f < 8.5) return mix(YES, INK, 0.15 + 0.25 * aSeed.y);        // verdict
    return mix(INK, sideCol(), uTint * 0.35);                        // count
  }
  float formAlpha(float f) {
    if (f > 8.5) return 0.4;                // count — bright but readable
    if (f > 7.5) return 1.0;                // verdict YES
    if (f > 6.5) return step(aSeed.y, 0.4); // mini coin keeps ~40%
    if (f > 5.5) return 0.4;                // burst — sparse rain, not a wall
    return 1.0;
  }

  void main() {
    vec3 pa = formPos(uFormA);
    vec3 pb = formPos(uFormB);
    // Per-particle stagger: each departs/arrives on its own offset. At
    // uKindLag 1 (the entrance birth) the offset runs by build tier
    // instead — rim ring erupts first, face condenses behind it, the $
    // stamps last (its 0.25 window = the stamp's snap). The divisor blend
    // keeps uKindLag 0 bit-identical to the original 0.7 constant.
    float kd = 0.28 * (1.0 - step(0.5, aKind)) + 0.52 * step(1.5, aKind);
    float off = mix(aSeed.w * 0.3, kd + aSeed.w * 0.23, uKindLag);
    float m = smoothstep(0.0, 1.0,
                         clamp((uMix - off) / mix(0.7, 1.0 - off, uKindLag),
                               0.0, 1.0));
    vec3 p = mix(pa, pb, m);
    // Curl turbulence, peaking mid-transition, zero at endpoints.
    float env = 4.0 * m * (1.0 - m);
    p += curl(p * (2.0 / uHalfH) + aSeed.xyz * 7.0, uTime)
         * (uTurb * env * (0.5 + aSeed.y) * uHalfH * 0.35);

    vColor = mix(formCol(uFormA, pa), formCol(uFormB, pb), m);
    // face 0.3, rim 0.7, glyph 0.65 — the $ packs far more particles per
    // pixel than the rim, so its tier must sit LOWER or it blooms to a blob
    float bright = 0.3 + 0.4 * step(0.5, aKind) - 0.05 * step(1.5, aKind);
    // The count numerals draw from every tier — flatten to one luminous level
    float cw = mix(step(8.5, uFormA), step(8.5, uFormB), m);
    bright = mix(bright, 0.85, cw);
    vAlpha = uAlpha * uExposure
             * mix(formAlpha(uFormA), formAlpha(uFormB), m) * bright;

    // Additive points can't occlude, so the rear face's $ ghosts through at
    // oblique angles. Fade glyph particles facing away (in coin/mini forms —
    // NOT verdict, whose particles come from every tier).
    float isCoin = step(1.5, uFormA) * (1.0 - step(2.5, uFormA))
                 + step(6.5, uFormA) * (1.0 - step(7.5, uFormA));
    float isCoinB = step(1.5, uFormB) * (1.0 - step(2.5, uFormB))
                  + step(6.5, uFormB) * (1.0 - step(7.5, uFormB));
    float coinW = mix(isCoin, isCoinB, m);
    // Whole-face fade via the face normal (uniform across the glyph — a
    // per-particle depth fade goes patchy since rotated z varies with x).
    float nz = cos(uSpin) * sign(position.z);
    float front = smoothstep(0.0, 0.3, nz);
    vAlpha *= mix(1.0, front, step(1.5, aKind) * coinW);

    // The resolution scanline: a white-hot vertical front over the ribbon.
    float isRibA = step(3.5, uFormA) * (1.0 - step(4.5, uFormA));
    float isRibB = step(3.5, uFormB) * (1.0 - step(4.5, uFormB));
    float rw = mix(isRibA, isRibB, m);
    float sg = exp(-abs(p.x - uSweep * uHalfW) * (5.0 / uHalfH)) * rw;
    vColor += vec3(1.0) * sg * 0.9;
    vAlpha *= 1.0 + sg * 1.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uPx * (0.018 + 0.014 * aSeed.z)
                         * (1.0 + 0.5 * step(0.5, aKind))
                         * mix(1.0, 0.78, cw)  // finer grain for numerals
                         * (9.0 / -mv.z), 1.0, 14.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

/** Rasterize text in the pixel font (falls back to monospace pre-font-load).
 *  Returns points with x normalized to [-1, 1]; y keeps the canvas aspect. */
function rasterPoints(
  text: string,
  w: number,
  h: number,
  px: number,
  weight = 900
): [number, number][] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  if (!x) return [[0, 0]];
  const fam =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-pixel")
      .trim() || "monospace";
  x.fillStyle = "#000";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#fff";
  x.font = `${weight} ${px}px ${fam}, monospace`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, w / 2, h / 2 + px * 0.06);
  const d = x.getImageData(0, 0, w, h).data;
  const pts: [number, number][] = [];
  for (let py = 0; py < h; py += 2)
    for (let pxi = 0; pxi < w; pxi += 2)
      if (d[(py * w + pxi) * 4] > 128)
        pts.push([(pxi - w / 2) / (w / 2), -(py - h / 2) / (w / 2)]);
  return pts.length ? pts : [[0, 0]];
}

function buildAttributes(count: number) {
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seed[i] = Math.random();

  const glyph = rasterPoints("$", 160, 160, 130);
  // The verdict everyone scrolled for: a giant pixel YES. Lighter weight
  // than the $ so the S's counters stay open (900 reads like "$" at glow).
  const yes = rasterPoints("YES", 340, 130, 104, 700);
  const aYes = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = yes[(Math.random() * yes.length) | 0];
    aYes[i * 3] = p[0] + (Math.random() - 0.5) * 0.008;
    aYes[i * 3 + 1] = p[1] + (Math.random() - 0.5) * 0.008;
    aYes[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }

  const coin = new Float32Array(count * 3);
  const kind = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let x: number, y: number, z: number, k: number;
    if (r < 0.34) {
      // rim
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a);
      y = Math.sin(a);
      z = (Math.random() - 0.5) * 0.16;
      k = 1;
    } else if (r < 0.93) {
      // faces
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * 0.97;
      x = Math.cos(a) * rr;
      y = Math.sin(a) * rr;
      z = (Math.random() < 0.5 ? -1 : 1) * 0.08;
      k = 0;
    } else {
      // $ glyph, both faces (small share — additive stacking overexposes fast)
      const p = glyph[(Math.random() * glyph.length) | 0];
      x = p[0] * 0.66 + (Math.random() - 0.5) * 0.015;
      y = p[1] * 0.66 + (Math.random() - 0.5) * 0.015;
      z = (Math.random() < 0.5 ? -1 : 1) * 0.1;
      k = 2;
    }
    coin[i * 3] = x;
    coin[i * 3 + 1] = y;
    coin[i * 3 + 2] = z;
    kind[i] = k;
  }
  return { seed, coin, kind, aYes };
}

const bgBase = new THREE.Color(LANDING_BG);
const bgResolved = new THREE.Color(LANDING_BG_RESOLVED);
const bgTmp = new THREE.Color();

/* ── Living backdrop: drifting duo-tone nebula + twinkling starfield ──
   A fullscreen quad far behind the particles, so the opaque canvas still
   owns the whole background (bloom composer needs it opaque). */
const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const backdropFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uAspect, uShift, uGlow, uWorldY;
  uniform vec2 uPointer;

  const vec3 YES  = ${vec3(YES_HEX)};
  const vec3 NO   = ${vec3(NO_HEX)};
  const vec3 BASE = ${vec3(LANDING_BG)};
  const vec3 RES  = ${vec3(LANDING_BG_RESOLVED)};

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    vec3 col = mix(BASE, RES, uShift);

    // two slow nebula glows, one per side of the market
    vec2 b1 = vec2(sin(uTime * 0.050) * 0.7 - 0.4,
                   cos(uTime * 0.043) * 0.5 + 0.35 - uWorldY * 0.5)
            + uPointer * 0.18;
    vec2 b2 = vec2(cos(uTime * 0.047) * 0.7 + 0.45,
                   sin(uTime * 0.039) * 0.5 - 0.40 - uWorldY * 0.35)
            - uPointer * 0.18;
    col += YES * exp(-dot(p - b1, p - b1) * 2.3) * 0.10 * uGlow;
    col += NO  * exp(-dot(p - b2, p - b2) * 2.7) * 0.08 * uGlow;

    // two parallax layers of drifting, twinkling stars
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 q = p * (34.0 + fi * 28.0)
             + vec2(uTime * (0.55 + fi * 0.45),
                    uTime * 0.18 + uWorldY * (16.0 + fi * 12.0))
             + uPointer * (3.0 + fi * 4.0);
      vec2 id = floor(q);
      vec2 f = fract(q) - 0.5;
      float h = hash21(id);
      float on = step(0.976, h);
      vec2 off = (vec2(hash21(id + 7.0), hash21(id + 13.0)) - 0.5) * 0.6;
      float d = length(f - off);
      // Twinkle from an INDEPENDENT hash — the existence hash clusters at
      // ~1.0 for every surviving star, which synced all their blinking.
      float h2 = hash21(id + 31.7);
      float tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + h2 * 2.6)
                                                + h2 * 18.85));
      col += vec3(0.90, 0.92, 0.95)
           * on * smoothstep(0.10, 0.0, d) * 0.30 * tw * uGlow;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Backdrop({ interactive }: { interactive: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: backdropVertex,
        fragmentShader: backdropFragment,
        uniforms: {
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uShift: { value: 0 },
          uGlow: { value: 0 },
          uWorldY: { value: 0 },
          uPointer: { value: new THREE.Vector2() },
        },
        depthWrite: false,
        depthTest: false,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const u = material.uniforms;
    // Reduced motion: freeze the drift, keep the nebula as a still image.
    if (interactive) u.uTime.value = state.clock.elapsedTime;
    u.uAspect.value = state.size.width / state.size.height;
    u.uShift.value = sceneMotion.bgShift;
    u.uGlow.value = sceneMotion.bgGlow;
    u.uWorldY.value = sceneMotion.worldY / HALF_H; // normalized to half-heights
    if (interactive) {
      u.uPointer.value.lerp(
        { x: state.pointer.x, y: state.pointer.y } as THREE.Vector2,
        0.04
      );
    }
    // Cover the frustum at z = -4 (camera at z = 9 → distance 13).
    if (mesh.current) {
      const hh = Math.tan((40 / 2) * (Math.PI / 180)) * 13;
      mesh.current.scale.set(
        hh * (state.size.width / state.size.height) * 2.2,
        hh * 2.2,
        1
      );
    }
  });

  return (
    <mesh ref={mesh} position={[0, 0, -4]} material={material} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

export function ParticleEngine({
  count,
  interactive = true,
}: {
  count: number;
  interactive?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);

  const geometry = useMemo(() => {
    const { seed, coin, kind, aYes } = buildAttributes(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(coin, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    g.setAttribute("aYes", new THREE.BufferAttribute(aYes, 3));
    // Loader numeral target — filled from the digit raster on first use
    const numB = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    numB.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aNumB", numB);
    return g;
  }, [count]);

  // Count numeral state: raster cache + per-particle stable random picks
  const numeralCache = useRef(new Map<string, [number, number][]>());
  const pickRef = useRef<Uint32Array | null>(null);
  const shownRef = useRef(-1);

  const fillNumeral = (attr: THREE.BufferAttribute, value: number) => {
    const key = String(value);
    let pts = numeralCache.current.get(key);
    if (!pts) {
      pts = rasterPoints(key, 340, 150, 118, 700);
      numeralCache.current.set(key, pts);
    }
    if (!pickRef.current) {
      const picks = new Uint32Array(count);
      for (let i = 0; i < count; i++) picks[i] = (Math.random() * 2 ** 32) >>> 0;
      pickRef.current = picks;
    }
    const seed = geometry.getAttribute("aSeed").array as Float32Array;
    const arr = attr.array as Float32Array;
    const picks = pickRef.current;
    for (let i = 0; i < count; i++) {
      const p = pts[picks[i] % pts.length];
      arr[i * 3] = p[0] + (seed[i * 4 + 1] - 0.5) * 0.02;
      arr[i * 3 + 1] = p[1] + (seed[i * 4 + 3] - 0.5) * 0.02;
      arr[i * 3 + 2] = (seed[i * 4 + 2] - 0.5) * 0.08;
    }
    attr.needsUpdate = true;
  };

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uHalfW: { value: HALF_H },
          uHalfH: { value: HALF_H },
          uCoinR: { value: HALF_H * 0.62 },
          uFormA: { value: 0 },
          uFormB: { value: 0 },
          uMix: { value: 0 },
          uSpin: { value: 0 },
          uRise: { value: 1.4 },
          uTint: { value: 0 },
          uDamp: { value: 1 },
          uAlpha: { value: 0 },
          uTurb: { value: 0 },
          uPx: { value: 300 },
          uExposure: { value: 1 },
          uSweep: { value: -2.5 },
          uTiltX: { value: 0.28 },
          uDissolve: { value: 0 },
          uKindLag: { value: 0 },
        },
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state, delta) => {
    const m = sceneMotion;
    const u = material.uniforms;
    spin.current += m.spinSpeed * delta;

    const halfW = HALF_H * (state.size.width / state.size.height);
    u.uTime.value = state.clock.elapsedTime;
    u.uHalfW.value = halfW;
    u.uCoinR.value = Math.min(halfW, HALF_H) * 0.5;
    u.uPx.value = state.size.height / (2 * HALF_H);
    // Additive blending sums per-pixel, so brightness ∝ particles per
    // projected pixel. Normalize by the coin's on-screen area (px²) per
    // particle; 1.14 calibrates to the tuned desktop look (150k @ ~199px).
    const coinRpx = u.uCoinR.value * u.uPx.value;
    u.uExposure.value = Math.min(1, (1.14 * coinRpx * coinRpx) / count);
    u.uFormA.value = m.formA;
    u.uFormB.value = m.formB;
    u.uMix.value = m.mix;
    u.uSpin.value = spin.current;
    u.uRise.value = m.rise;
    u.uTint.value = m.tint;
    u.uDamp.value = m.damp;
    u.uAlpha.value = m.alpha;
    u.uTurb.value = m.turb;
    u.uSweep.value = m.sweep;
    u.uTiltX.value = m.tilt;
    u.uDissolve.value = m.dissolve;
    u.uKindLag.value = m.kindLag;

    // The particle numerals only ever show round(countValue) — the DOM
    // counter does the visible counting; particles take over at 100.
    if (m.formA === FORM.COUNT || m.formB === FORM.COUNT) {
      const numB = geometry.getAttribute("aNumB") as THREE.BufferAttribute;
      const target = Math.round(m.countValue);
      if (shownRef.current !== target) {
        fillNumeral(numB, target);
        shownRef.current = target;
      }
    }

    bgTmp.lerpColors(bgBase, bgResolved, m.bgShift);
    state.gl.setClearColor(bgTmp, 1);

    if (group.current) {
      const tx = interactive ? state.pointer.y * -0.06 : 0;
      const ty = interactive ? state.pointer.x * 0.08 : 0;
      group.current.rotation.x = THREE.MathUtils.damp(
        group.current.rotation.x, tx, 4, delta);
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y, ty, 4, delta);
      // Chapter-driven camera push-in (scale ≈ dolly for a fixed camera)
      const z = THREE.MathUtils.damp(group.current.scale.x, m.zoom, 4, delta);
      group.current.scale.setScalar(z);
      // The entrance drop-in ride (coin falls to the floor and stands up)
      group.current.position.y = m.posY;
    }
  });

  return (
    <>
      <Backdrop interactive={interactive} />
      <group ref={group}>
        <points geometry={geometry} material={material} frustumCulled={false} />
      </group>
    </>
  );
}
