"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ParticleEngine } from "./ParticleEngine";

// Probe once per page load and release the probe context immediately —
// leaked probe contexts count against the browser's WebGL context cap and
// can evict the live canvas ("THREE.WebGLRenderer: Context Lost").
let webglSupport: boolean | null = null;

export function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglSupport = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function getVisibilitySnapshot() {
  return document.visibilityState === "visible";
}

function getVisibilityServerSnapshot() {
  return true;
}

/** Fires onReady once, after the scene has actually rendered a frame. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (!fired.current) {
      fired.current = true;
      onReady();
    }
  });
  return null;
}

/** Bloom composer replacing R3F's default render (priority 1 render pass). */
function Effects() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        0.35, // strength
        0.6, // radius
        0.35 // threshold — only genuinely bright clusters bloom
      )
    );
    return c;
    // size is handled by the setSize effect below, not a composer rebuild
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => composer.render(), 1);
  return null;
}

export function ParticleCanvas({
  onReady,
  interactive = true,
  eventSource,
  count,
}: {
  onReady: () => void;
  interactive?: boolean;
  /** Element R3F listens on for pointer movement. The canvas itself is
   *  click-through (see below), so without this the parallax would stop
   *  tracking the cursor entirely. */
  eventSource?: React.RefObject<HTMLElement | null>;
  count: number;
}) {
  // If WebGL is missing, report ready immediately so the page never hangs.
  const webgl = supportsWebGL();
  useEffect(() => {
    if (!webgl) onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  // Pause rendering while the tab is hidden.
  const visible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot
  );

  if (!webgl) return null;

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ fov: 40, position: [0, 0, 9] }}
        dpr={[1, 1.75]}
        gl={{ alpha: false, antialias: false }}
        frameloop={visible ? "always" : "never"}
        // react-three-fiber writes `pointer-events: auto` INLINE on its own
        // container, which beats the `pointer-events-none` on the wrapper
        // above. Forcing it back to none keeps every landing button
        // reachable; R3F listens on the page root instead (eventSource).
        style={{ pointerEvents: "none" }}
        // React 19 types useRef(null) as RefObject<T | null>; R3F's prop type
        // predates that and wants a non-nullable RefObject. The ref is always
        // populated by the time this renders, so the cast is safe.
        eventSource={eventSource as React.RefObject<HTMLElement> | undefined}
        eventPrefix="client"
      >
        <ReadySignal onReady={onReady} />
        <ParticleEngine count={count} interactive={interactive} />
        <Effects />
      </Canvas>
    </div>
  );
}
