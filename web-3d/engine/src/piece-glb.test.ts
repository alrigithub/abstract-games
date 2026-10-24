import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { prepareAuthoredPieceGlb } from './piece-glb';
import { applyGhostOpacity, clonePieceVisualTemplate } from './ghost-visual';

describe('authored white stone lighting', () => {
  it('makes baked white stone lit and shadow receiving without losing its texture', () => {
    const map = new THREE.Texture();
    const source = new THREE.MeshBasicMaterial({ name: 'yinsh-ring-white baked stone', map, side: THREE.DoubleSide });
    const geometry = new THREE.BoxGeometry();
    geometry.deleteAttribute('normal');
    const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(geometry, source);
    const root = new THREE.Group().add(mesh);
    prepareAuthoredPieceGlb(root);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) throw new Error('Expected lit white stone');
    expect(mesh.material.map).toBe(map);
    expect(mesh.material.color.equals(source.color)).toBe(true);
    expect(mesh.material.roughness).toBe(0.9);
    expect(mesh.material.side).toBe(THREE.DoubleSide);
    expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
    expect(geometry.getAttribute('normal')).toBeDefined();
    const ghost = clonePieceVisualTemplate(root);
    applyGhostOpacity(ghost);
    expect(mesh.material.opacity).toBe(1);
    expect(mesh.material.transparent).toBe(false);
  });

  it('preserves existing PBR black stone and other unlit materials in multi-material meshes', () => {
    const normalMap = new THREE.Texture();
    const black = new THREE.MeshStandardMaterial({ name: 'go-stone-black final', roughness: 0.6, normalMap });
    const label = new THREE.MeshBasicMaterial({ name: 'label' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [black, label]);
    prepareAuthoredPieceGlb(new THREE.Group().add(mesh));
    const result = mesh.material[0];
    expect(result).toBeInstanceOf(THREE.MeshStandardMaterial);
    if (!(result instanceof THREE.MeshStandardMaterial)) throw new Error('Expected PBR black stone');
    expect(result.normalMap).toBe(normalMap);
    expect(result.roughness).toBe(0.6);
    expect(result).not.toBe(black);
    expect(mesh.material[1]).toBeInstanceOf(THREE.MeshBasicMaterial);
  });
});
