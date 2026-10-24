import * as THREE from 'three';

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Same vertical lerp as board-scene render (full 3D slide along from→to). */
export function lerpPiecePosition(
  from: THREE.Vector3,
  to: THREE.Vector3,
  t: number,
  ease: (u: number) => number,
): THREE.Vector3 {
  const u = ease(clamp01(t));
  return new THREE.Vector3().lerpVectors(from, to, u);
}

/**
 * Straight eased glide plus a lift arc that peaks mid-travel and lands flush
 * (`lift === 0` matches {@link lerpPiecePosition}).
 */
export function liftSlidePosition(
  from: THREE.Vector3,
  to: THREE.Vector3,
  t: number,
  ease: (u: number) => number,
  lift = 0,
): THREE.Vector3 {
  const raw = clamp01(t);
  const p = lerpPiecePosition(from, to, raw, ease);
  if (lift !== 0) p.y += 4 * lift * raw * (1 - raw);
  return p;
}

export function samplePieceSlide(
  from: THREE.Vector3,
  to: THREE.Vector3,
  sampleCount: number,
  ease: (u: number) => number,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    out.push(lerpPiecePosition(from, to, i / sampleCount, ease));
  }
  return out;
}
