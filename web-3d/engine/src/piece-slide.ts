import * as THREE from 'three';

/** Same vertical lerp as board-scene render (full 3D slide along from→to). */
export function lerpPiecePosition(
  from: THREE.Vector3,
  to: THREE.Vector3,
  t: number,
  ease: (u: number) => number,
): THREE.Vector3 {
  const u = ease(Math.min(1, Math.max(0, t)));
  return new THREE.Vector3().lerpVectors(from, to, u);
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
