import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lerpPiecePosition, samplePieceSlide } from '@abstract/three-engine/piece-slide';
import { easeInOutCubic } from './animation';

describe('boop push slide interpolation', () => {
  it('slides continuously to the exact destination without overshoot', () => {
    const from = new THREE.Vector3(0.2, 0.05, -0.4);
    const to = new THREE.Vector3(0.6, 0.05, -0.4);
    const frames = samplePieceSlide(from, to, 20, easeInOutCubic);
    const end = frames.at(-1)!;
    expect(end.distanceTo(to)).toBeLessThan(1e-6);

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1]!;
      const cur = frames[i]!;
      expect(cur.distanceTo(prev)).toBeGreaterThan(0);
      expect(cur.x).toBeGreaterThanOrEqual(from.x - 1e-6);
      expect(cur.x).toBeLessThanOrEqual(to.x + 1e-6);
    }
  });

  it('does not toggle visibility when the same id stays in every snapshot frame', () => {
    const pieceId = 'push-me';
    const snapshots = [
      [{ id: pieceId, player: 'A', shape: 'kitten' }],
      [{ id: pieceId, player: 'A', shape: 'kitten' }],
      [{ id: pieceId, player: 'A', shape: 'kitten' }],
    ];
    let visible = false;
    let toggles = 0;
    for (const stack of snapshots) {
      const present = stack.some(p => p.id === pieceId);
      if (present !== visible) toggles++;
      visible = present;
    }
    expect(toggles).toBe(1);
    expect(visible).toBe(true);
  });

  it('matches engine lerp at mid-frame', () => {
    const from = new THREE.Vector3(1, 0, 2);
    const to = new THREE.Vector3(4, 0, 2);
    const mid = lerpPiecePosition(from, to, 0.5, easeInOutCubic);
    expect(mid.x).toBeCloseTo(THREE.MathUtils.lerp(from.x, to.x, easeInOutCubic(0.5)), 5);
  });
});
