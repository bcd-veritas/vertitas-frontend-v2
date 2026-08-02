/** Formation ids — must match the vertex shader's if-chain in ParticleEngine. */
export const FORM = {
  NOISE: 0,
  VORTEX: 1,
  COIN: 2,
  STREAMS: 3,
  RIBBON: 4,
  POINT: 5,
  BURST: 6,
  MINI: 7,
  /** giant pixel "YES" — the resolution verdict */
  VERDICT: 8,
  /** entrance loader numerals — targets stream from aNumA/aNumB buffers */
  COUNT: 9,
} as const;

/** World half-height at z=0 for the shared camera (fov 40, z=9). */
export const WORLD_HALF_H = Math.tan((40 / 2) * (Math.PI / 180)) * 9;

export const YES_HEX = "#6ee7a0"; // Yes — always identified by label
export const NO_HEX = "#ff6b5e"; // No
export const INK_HEX = "#f2efec";
export const LANDING_BG = "#0a0a0e";
/** bg washed faintly mint after resolution */
export const LANDING_BG_RESOLVED = "#081007";

export type SceneMotion = {
  formA: number;
  formB: number;
  /** 0..1 blend from formA to formB */
  mix: number;
  /** entrance: particles start this many world units below their noise spot */
  rise: number;
  /** 0 = white particles, 1 = fully duo-tinted (entrance color seep) */
  tint: number;
  /** ribbon oscillation amplitude 1..0 (truth chapter damps it) */
  damp: number;
  /** master particle opacity */
  alpha: number;
  /** coin spin, radians/sec (accumulated in the engine) */
  spinSpeed: number;
  /** curl turbulence strength; shader multiplies by 4·m·(1−m) envelope */
  turb: number;
  /** 0 = LANDING_BG, 1 = LANDING_BG_RESOLVED */
  bgShift: number;
  /** resolution scanline x, in uHalfW units (-2.5 = parked off-screen) */
  sweep: number;
  /** camera push-in factor (scales the particle group) */
  zoom: number;
  /** nebula/starfield backdrop intensity 0..1 */
  bgGlow: number;
  /** entrance loader value 0..100 — the engine rasters round(countValue) */
  countValue: number;
  /** count numerals: 0 = solid-still (matches the DOM counter), 1 = fully
   *  disintegrated — drives the grain-up/fray-apart dissolve at 100 */
  dissolve: number;
  /** coin rotX — 0.28 is the hero pose, π/2+2πk lies it flat (k = tumbles) */
  tilt: number;
  /** particle group world-y offset (the coin's fall to the floor) */
  posY: number;
  /** camera-rise offset, world units — hand & backdrop sink by this while
   *  the "camera" rides up after the tossed coin */
  worldY: number;
};

/** State at the very start of the forge entrance: the count begins at 0. */
export const ENTRY_MOTION: SceneMotion = {
  formA: FORM.COUNT,
  formB: FORM.COUNT,
  mix: 0,
  rise: 0,
  tint: 0,
  damp: 1,
  alpha: 0,
  spinSpeed: 0, // numerals hold still; the flip spins them up at 100
  turb: 0,
  bgShift: 0,
  sweep: -2.5,
  zoom: 1.15,
  bgGlow: 0,
  countValue: 100, // the DOM counter counts; particles only ever show 100
  dissolve: 0,
  tilt: 0.28,
  posY: 0,
  worldY: 0,
};

/** Settled hero state (reduced-motion / no-WebGL / post-entrance target). */
export const SETTLED_MOTION: SceneMotion = {
  ...ENTRY_MOTION,
  formA: FORM.COIN,
  formB: FORM.COIN,
  rise: 0,
  tint: 0.6,
  alpha: 1,
  spinSpeed: 0.35,
  zoom: 1,
  bgGlow: 1,
};

/** Single shared instance — GSAP writes it, R3F reads it every frame. */
export const sceneMotion: SceneMotion = { ...ENTRY_MOTION };

export function resetSceneMotion(to: SceneMotion = ENTRY_MOTION) {
  Object.assign(sceneMotion, to);
}

/** Particle counts by device class. */
export const COUNT_DESKTOP = 150_000;
export const COUNT_MOBILE = 40_000;
