"use client";

import { useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";
import { supportsWebGL } from "../landing/three/TokenCanvas";

/**
 * The reference's RENDERING INSTANCE CLOUD, faithfully: a three.js field of
 * wireframe planes (two triangles each — hence the diagonal) distributed in
 * depth, streaming slowly toward the camera with a slight per-plane tumble,
 * so quads grow and drift outward from a central vanishing point.
 * The scatter is seeded — identical every load. Under prefers-reduced-motion
 * the field renders but holds still.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNT = 110;
/** How far back the field extends (world units). */
const DEPTH = 70;
/** Quads wrap to the back once they pass just behind the camera plane. */
const NEAR_WRAP = 5;
/** Streaming speed toward the camera, world units/second. */
const SPEED = 2.2;

const FIELD = (() => {
  const rng = mulberry32(0xc10dd);
  return Array.from({ length: COUNT }, () => ({
    x: (rng() * 2 - 1) * 60,
    y: (rng() * 2 - 1) * 26,
    z: NEAR_WRAP - rng() * DEPTH,
    rx: rng() * Math.PI * 2,
    ry: rng() * Math.PI * 2,
    rz: rng() * Math.PI * 2,
    scale: 0.8 + rng() * 5.2,
    tumbleX: (rng() * 2 - 1) * 0.22,
    tumbleY: (rng() * 2 - 1) * 0.22,
  }));
})();

// Shared GPU resources — module singletons, never disposed (one page uses this).
const PLANE = new THREE.PlaneGeometry(1, 0.72);
const WIRE = new THREE.MeshBasicMaterial({
  color: "#f2efed",
  wireframe: true,
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
});

function CloudField({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!animate || !group.current) return;
    const d = Math.min(delta, 0.1); // clamp tab-resume jumps
    for (const mesh of group.current.children) {
      const tumble = mesh.userData as { tx: number; ty: number };
      mesh.position.z += SPEED * d;
      mesh.rotation.x += tumble.tx * d;
      mesh.rotation.y += tumble.ty * d;
      if (mesh.position.z > NEAR_WRAP) mesh.position.z -= DEPTH;
    }
  });

  return (
    <group ref={group}>
      {FIELD.map((f, i) => (
        <mesh
          key={i}
          geometry={PLANE}
          material={WIRE}
          position={[f.x, f.y, f.z]}
          rotation={[f.rx, f.ry, f.rz]}
          scale={f.scale}
          userData={{ tx: f.tumbleX, ty: f.tumbleY }}
        />
      ))}
    </group>
  );
}

const emptySubscribe = () => () => {};

export function InstanceCloud() {
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
          camera={{ position: [0, 0, 7], fov: 55 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
        >
          <CloudField animate={!reduced} />
        </Canvas>
      )}
    </div>
  );
}
