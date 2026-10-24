import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyGhostOpacity, clonePieceVisualTemplate } from './ghost-visual';

describe('ghost-visual material isolation', () => {
  it('ghost opacity does not mutate template materials shared by clone(true)', () => {
    const template = new THREE.Group();
    const shared = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 1, transparent: false });
    template.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared));

    const live = clonePieceVisualTemplate(template);
    const ghost = clonePieceVisualTemplate(template);
    applyGhostOpacity(ghost, 0.24);

    expect(shared.opacity).toBe(1);
    expect(shared.transparent).toBe(false);
    expect(shared.depthWrite).toBe(true);

    live.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = node.material as THREE.MeshStandardMaterial;
      expect(mat).not.toBe(shared);
      expect(mat.opacity).toBe(1);
      expect(mat.transparent).toBe(false);
    });

    ghost.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = node.material as THREE.MeshStandardMaterial;
      expect(mat.opacity).toBe(0.24);
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
    });
  });

  it('in-place ghost tint on clone(true) leaks to template (why we clone materials per instance)', () => {
    const template = new THREE.Group();
    const shared = new THREE.MeshStandardMaterial({ opacity: 1, transparent: false, depthWrite: true });
    template.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared));
    const naive = template.clone(true);
    naive.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = node.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = 0.24;
      mat.depthWrite = false;
    });
    expect(shared.opacity).toBe(0.24);
    expect(shared.transparent).toBe(true);
    expect(shared.depthWrite).toBe(false);
  });
});
