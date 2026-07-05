"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Token } from "./Token";
import { MeshWaves } from "./MeshWaves";

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

export function TokenCanvas({
  onReady,
  interactive = true,
}: {
  onReady: () => void;
  interactive?: boolean;
}) {
  // If WebGL is missing, report ready immediately so the loader never hangs.
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
    <div aria-hidden="true" className="fixed inset-0 z-20 pointer-events-none">
      <Canvas
        camera={{ fov: 40, position: [0, 0, 9] }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        frameloop={visible ? "always" : "never"}
      >
        <ReadySignal onReady={onReady} />
        <Token interactive={interactive} />
        <MeshWaves />
      </Canvas>
    </div>
  );
}
