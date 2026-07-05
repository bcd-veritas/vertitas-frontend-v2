"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import * as THREE from "three";
import { tokenMotion } from "./tokenMotion";

const ACCENT = "#f6dcd4";
const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

// Upward-trending sparkline the coin unrolls into over the markets section.
const CHART_POINTS: [number, number][] = [
  [-1.15, -0.75],
  [-0.75, -0.25],
  [-0.35, -0.5],
  [0.05, 0.05],
  [0.45, -0.15],
  [0.85, 0.55],
  [1.15, 0.8],
];

/**
 * The morphing ribbon: an open-ended wireframe cylinder (the coin's rim).
 * The vertex shader unrolls it — each vertex's angle on the circle maps to
 * an x position along the chart, and its y follows the sparkline curve — so
 * the rim visibly unfurls into the line chart instead of crossfading.
 */
const ribbonVertex = /* glsl */ `
  uniform float uMorph;
  uniform vec2 uPts[${CHART_POINTS.length}];

  float chartY(float x) {
    float y = uPts[0].y;
    for (int i = 0; i < ${CHART_POINTS.length - 1}; i++) {
      float t = clamp((x - uPts[i].x) / (uPts[i + 1].x - uPts[i].x), 0.0, 1.0);
      y = mix(y, uPts[i + 1].y, t);
    }
    return y;
  }
    

  void main() {
    vec3 p = position;
    float r = length(p.xy);
    float theta = atan(p.y, p.x);
    // Unroll: angle -> chart x; radius spread -> slight line thickness
    float xt = (theta / 3.14159265) * 1.15;
    vec3 target = vec3(xt, chartY(xt) + (r - 1.0) * 0.5, p.z * 0.15);
    float e = uMorph * uMorph * (3.0 - 2.0 * uMorph); // smoothstep ease
    vec3 pos = mix(p, target, e);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const ribbonFragment = /* glsl */ `
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(0.965, 0.863, 0.831, uOpacity);
  }
`;

// ── Module-scope GPU resources ─────────────────────────────────────────
// Created once per page load (this module only loads client-side — the
// canvas is dynamic ssr:false). The frame loop mutates them freely, which
// sidesteps React 19's render-immutability rules the same way tokenMotion
// does. Only one <Token> ever exists.
const coinWireMat = new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.5 });
const coinFillMat = new THREE.MeshBasicMaterial({ color: "#141010", transparent: true, opacity: 0.88 });
const dollarMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 1 });
const pointMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 });
const ribbonMat = new THREE.ShaderMaterial({
  vertexShader: ribbonVertex,
  fragmentShader: ribbonFragment,
  uniforms: {
    uMorph: { value: 0 },
    uOpacity: { value: 0 },
    uPts: { value: CHART_POINTS.map(([x, y]) => new THREE.Vector2(x, y)) },
  },
  wireframe: true,
  transparent: true,
  depthWrite: false,
});
// Rim circle facing the camera (cylinder axis baked onto Z).
const ribbonGeo = new THREE.CylinderGeometry(1, 1, 0.16, 48, 1, true);
ribbonGeo.rotateX(Math.PI / 2);

export function Token({ interactive = true }: { interactive?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const coinGroup = useRef<THREE.Group>(null);
  const chartGroup = useRef<THREE.Group>(null);
  const spinAccum = useRef(0);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const m = tokenMotion;
    spinAccum.current += m.spin * delta;
    g.position.set(m.x, m.y, m.z);
    g.scale.setScalar(m.scale);
    const tiltX = interactive ? state.pointer.y * -0.12 : 0;
    const tiltZ = interactive ? state.pointer.x * 0.08 : 0;
    g.rotation.set(m.rotX + tiltX, 0, m.rotZ + tiltZ);
    // Only the coin spins; the ribbon/chart always face the camera.
    if (coinGroup.current) {
      coinGroup.current.rotation.y = m.rotY + spinAccum.current;
    }

    // ── Unfold sequencing ──
    const morph = Math.min(1, Math.max(0, m.morph));
    // Coin face + $ dissolve early; the ribbon carries the transition.
    const coin = 1 - THREE.MathUtils.smoothstep(morph, 0, 0.45);
    coinWireMat.opacity = 0.5 * coin;
    coinFillMat.opacity = 0.88 * coin;
    dollarMat.opacity = coin;
    if (coinGroup.current) coinGroup.current.visible = coin > 0.01;
    // Ribbon appears the moment the unfold starts, stays as the chart line.
    ribbonMat.uniforms.uMorph.value = morph;
    ribbonMat.uniforms.uOpacity.value = morph < 0.02 ? 0 : 0.85 * Math.min(1, morph * 6);
    // Data dots pop in as the line settles.
    pointMat.opacity = THREE.MathUtils.smoothstep(morph, 0.75, 1);
    if (chartGroup.current) chartGroup.current.visible = morph > 0.02;
  });

  const dollar = (z: number, flip: boolean) => (
    <group key={z} position={[0, 0, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <Center>
        <Text3D font={FONT_URL} size={0.7} height={0.05} curveSegments={5} material={dollarMat}>
          $
        </Text3D>
      </Center>
    </group>
  );

  return (
    <group ref={group}>
      {/* ── Coin form (spins) ── */}
      <group ref={coinGroup}>
        {/* Coin body: cylinder axis is Y; rotate so faces point at the camera (Z) */}
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={coinWireMat}>
            <cylinderGeometry args={[1, 1, 0.16, 48, 1]} />
          </mesh>
          {/* Inner dark fill so rear wireframe lines read as depth, not noise */}
          <mesh scale={[0.985, 0.9, 0.985]} material={coinFillMat}>
            <cylinderGeometry args={[1, 1, 0.16, 48, 1]} />
          </mesh>
        </group>
        {dollar(0.1, false)}
        {dollar(-0.1, true)}
      </group>

      {/* ── Unrolling ribbon + chart dots (camera-facing) ── */}
      <group ref={chartGroup} visible={false}>
        <mesh geometry={ribbonGeo} material={ribbonMat} />
        {CHART_POINTS.map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0]} material={pointMat}>
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
