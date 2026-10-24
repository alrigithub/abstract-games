import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getClayMaterial } from './clay-materials';
import { applyGhostOpacity, clonePieceVisualTemplate } from './ghost-visual';

describe('ghost-visual material isolation', () => {
  it('live clay clones share bank materials; ghosts clone before tinting', () => {
    const template = new THREE.Group();
    const shared = getClayMaterial('piece_light');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
    mesh.userData.clayMaterialRole = 'piece_light';
    template.add(mesh);

    const live = clonePieceVisualTemplate(template);
    const ghost = clonePieceVisualTemplate(template);
    applyGhostOpacity(ghost, 0.24);

    live.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      expect(node.material).toBe(shared);
      expect((node.material as THREE.MeshStandardMaterial).opacity).toBe(1);
    });

    ghost.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = node.material as THREE.MeshStandardMaterial;
      expect(mat).not.toBe(shared);
      expect(mat.opacity).toBe(0.24);
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
    });
  });

  it('in-place ghost tint on clone(true) leaks to template (why applyGhostOpacity clones materials)', () => {
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
