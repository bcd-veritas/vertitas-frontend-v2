"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";
import { supportsWebGL } from "../landing/three/TokenCanvas";

/**
 * The landing page's wave horizon, retuned for the terminal hero: same
 * wireframe swell, but the fragment color is a uniform fed by the leading
 * outcome's rank color, lerped smoothly whenever the leader changes.
 * Under prefers-reduced-motion the field renders one still frame.
 */

const vertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 0.55 + uTime * 0.6) * 0.45
         + sin(p.y * 0.85 + uTime * 0.4) * 0.35
         + sin((p.x + p.y) * 0.3 + uTime * 0.25) * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    // Fade toward all edges so the waves read as horizon terrain behind the
    // hero copy, never over it.
    float edgeFade = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x)
                   * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    gl_FragColor = vec4(uColor, edgeFade * 0.22);
  }
`;

function WaveField({ tint, animate }: { tint: string; animate: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const target = useMemo(() => new THREE.Color(tint), [tint]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: animate ? 0 : 3.7 },
      uColor: { value: new THREE.Color(tint) },
    }),
    // Initial value only — live updates happen in useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    if (!material.current) return;
    if (animate) material.current.uniforms.uTime.value = state.clock.elapsedTime;
    (material.current.uniforms.uColor.value as THREE.Color).lerp(target, 0.04);
  });

  return (
    <mesh rotation={[-Math.PI / 2.2, 0, 0]} position={[0, -2.4, -4.5]}>
      <planeGeometry args={[30, 16, 100, 50]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        ref={material}
        wireframe
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

const emptySubscribe = () => () => {};

export function SignalWaves({ tint }: { tint: string }) {
  const reduced = usePrefersReducedMotion();
  // Canvas is client-only; mount it after hydration without a mismatch.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      {mounted && supportsWebGL() && (
        <Canvas
          camera={{ position: [0, 0.6, 7], fov: 55 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
        >
          <WaveField tint={tint} animate={!reduced} />
        </Canvas>
      )}
    </div>
  );
}
