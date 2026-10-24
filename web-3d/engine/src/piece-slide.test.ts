import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lerpPiecePosition, liftSlidePosition, samplePieceSlide } from './piece-slide';

const linear = (t: number) => t;

describe('piece-slide', () => {
  it('ends at the target position', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(3, 0, -2);
    const end = lerpPiecePosition(from, to, 1, linear);
    expect(end.distanceTo(to)).toBeLessThan(1e-9);
  });

  it('lift arc starts and lands flush and peaks mid-glide', () => {
    const from = new THREE.Vector3(0, 0.1, 0);
    const to = new THREE.Vector3(4, 0.1, 2);
    const lift = 0.25;
    const start = liftSlidePosition(from, to, 0, linear, lift);
    const mid = liftSlidePosition(from, to, 0.5, linear, lift);
    const end = liftSlidePosition(from, to, 1, linear, lift);
    expect(start.distanceTo(from)).toBeLessThan(1e-9);
    expect(end.distanceTo(to)).toBeLessThan(1e-9);
    expect(mid.y).toBeCloseTo(0.1 + lift, 8);
    expect(liftSlidePosition(from, to, 0.5, linear, 0).y).toBeCloseTo(0.1, 8);
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
