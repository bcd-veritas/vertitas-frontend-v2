"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { tokenMotion } from "./tokenMotion";

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
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // Fade hard toward all edges and toward the camera so the waves read as
    // faint horizon terrain behind the content, never over it.
    float edgeFade = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x)
                   * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    gl_FragColor = vec4(vec3(0.965, 0.863, 0.831), uOpacity * edgeFade * 0.13);
  }
`;

export function MeshWaves() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 1 } }),
    []
  );

  // useFrame((state) => {
  //   if (!material.current) return;
  //   material.current.uniforms.uTime.value = state.clock.elapsedTime;
  //   material.current.uniforms.uOpacity.value = tokenMotion.wavesOpacity;
  //   material.current.visible = tokenMotion.wavesOpacity > 0.01;
  // });
  useFrame((state) => {
    if (!material.current) return;

    material.current.uniforms.uTime.value = state.clock.elapsedTime;

    const targetOpacity = Math.max(tokenMotion.wavesOpacity, 0.3);

    material.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      material.current.uniforms.uOpacity.value,
      targetOpacity,
      0.08
    );
  });

  return (
    <mesh rotation={[-Math.PI / 2.2, 0, 0]} position={[0, -2.4, -4.5]}>
      <planeGeometry args={[30, 16, 100, 50]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        wireframe
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
