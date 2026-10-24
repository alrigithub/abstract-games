import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lerpPiecePosition, samplePieceSlide } from './piece-slide';

const linear = (t: number) => t;

describe('piece-slide', () => {
  it('ends at the target position', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(3, 0, -2);
    const end = lerpPiecePosition(from, to, 1, linear);
    expect(end.distanceTo(to)).toBeLessThan(1e-9);
  });

  it('samples monotonic motion on a straight push axis', () => {
    const from = new THREE.Vector3(-1, 0, 0);
    const to = new THREE.Vector3(2, 0, 0);
    const frames = samplePieceSlide(from, to, 10, linear);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.x).toBeGreaterThanOrEqual(frames[i - 1]!.x - 1e-9);
    }
  });
});
