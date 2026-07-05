import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev"],
  // StrictMode's dev-only double-mount forces a WebGL context loss on the
  // react-three-fiber canvas (the same canvas element can't get a second
  // context), permanently killing the 3D token in `next dev`. Disabling is
  // the R3F-documented workaround; production is unaffected either way.
  reactStrictMode: false,
};

export default nextConfig;
