export type TokenMotion = {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  /** continuous spin speed, radians/sec around the coin's vertical axis */
  spin: number;
  /** hero mesh waves opacity 0..1 */
  wavesOpacity: number;
  /** 0 = coin, 1 = line chart (the mesh morphs over the markets section) */
  morph: number;
};

export const HERO_MOTION: TokenMotion = {
  x: 2.7,
  y: -0.1,
  z: 0,
  rotX: 0.25,
  rotY: 0,
  rotZ: 0,
  scale: 1.5,
  spin: 0.35,
  wavesOpacity: 1,
  morph: 0,
};

/** Single shared instance — GSAP tweens it, R3F reads it every frame. */
export const tokenMotion: TokenMotion = { ...HERO_MOTION };

export function resetTokenMotion() {
  Object.assign(tokenMotion, HERO_MOTION);
}
