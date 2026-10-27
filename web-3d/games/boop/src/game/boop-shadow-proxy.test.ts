import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyGhostOpacity,
  clonePieceVisualTemplate,
  PIECE_SKIP_CAST_SHADOW_USER_DATA,
  tagPieceForShadows,
  tagPieceGlbMeshesForShadows,
} from '@abstract/three-engine';
import { enableVaseShadows, prepareDetailedVaseGlb } from './boop-stone-cats';

describe('Boop detailed vase shadows', () => {
  function fixture() {
    const vase = new THREE.Group();
    vase.scale.setScalar(30);
    vase.position.y = .6;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(.02, .04, .02),
      new THREE.MeshBasicMaterial(),
    );
    body.position.y = .02;
    vase.add(body);
    const shadow = new THREE.BoxGeometry(.6, 1.2, .6).translate(0, 1.2, 0);
    return { vase, body, shadow, root: enableVaseShadows(vase, shadow) };
  }

  it('keeps the normalized caster beside authored transforms and aligned through clones', () => {
    const { root } = fixture();
    root.rotation.y = .37;
    root.position.set(2, 3, 4);
    const clone = clonePieceVisualTemplate(root);
    expect(clone.children).toHaveLength(2);
    const display = clone.children[0]!;
    const caster = clone.getObjectByName('boop-vase-shadow-proxy') as THREE.Mesh;
    const visibleBounds = new THREE.Box3().setFromObject(display);
    const casterBounds = new THREE.Box3().setFromObject(caster);
    expect(casterBounds.min.distanceTo(visibleBounds.min)).toBeLessThan(1e-6);
    expect(casterBounds.max.distanceTo(visibleBounds.max)).toBeLessThan(1e-6);
    expect(caster.scale.toArray()).toEqual([1, 1, 1]);
    expect(caster.userData.excludeFromPicking).toBe(true);
    expect(caster.userData.excludeFromBounds).toBe(true);
  });

  it('casts only the proxy after engine retagging, including VSM receiver handling', () => {
    const { root } = fixture();
    const clone = clonePieceVisualTemplate(root);
    tagPieceGlbMeshesForShadows(clone);
    tagPieceForShadows(clone, false);
    const body = clone.children[0]!.children[0] as THREE.Mesh;
    const caster = clone.getObjectByName('boop-vase-shadow-proxy') as THREE.Mesh;
    expect(body.userData[PIECE_SKIP_CAST_SHADOW_USER_DATA]).toBe(true);
    expect(body.castShadow).toBe(false);
    expect(body.receiveShadow).toBe(false);
    expect(caster.castShadow).toBe(true);
    const material = caster.material as THREE.MeshBasicMaterial;
    expect(material.visible).toBe(true);
    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(false);
  });

  it('disables the proxy for translucent ghosts without changing live clones', () => {
    const { root } = fixture();
    const ghost = clonePieceVisualTemplate(root);
    applyGhostOpacity(ghost);
    ghost.traverse(node => {
      if (node instanceof THREE.Mesh) {
        expect(node.castShadow).toBe(false);
        expect(node.receiveShadow).toBe(false);
      }
    });
    const caster = root.getObjectByName('boop-vase-shadow-proxy') as THREE.Mesh;
    expect(caster.castShadow).toBe(true);
    expect((caster.material as THREE.Material).transparent).toBe(false);
    expect(((ghost.getObjectByName(caster.name) as THREE.Mesh).material as THREE.Material).colorWrite).toBe(false);
  });

  it.each(['white', 'black'])('preserves the %s PBR maps and shading parameters', color => {
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({
      name: color, map, normalMap, color: 0xcccccc, roughness: .78, metalness: .02,
    });
    source.normalScale.set(.6, .7);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    prepareDetailedVaseGlb(mesh);
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material).not.toBe(source);
    expect(material.isMeshStandardMaterial).toBe(true);
    expect(material.map).toBe(map);
    expect(material.normalMap).toBe(normalMap);
    expect(material.normalScale.toArray()).toEqual([.6, .7]);
    expect(material.roughness).toBe(.78);
    expect(material.metalness).toBe(.02);
    expect(material.color.getHex()).toBe(0xcccccc);
    material.roughness = .4;
    expect(source.roughness).toBe(.78);
  });

  it('retains authored geometry normals for the detailed normal map', () => {
    const geometry = new THREE.BoxGeometry();
    const normals = geometry.getAttribute('normal');
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    prepareDetailedVaseGlb(mesh);
    expect(mesh.geometry.getAttribute('normal')).toBe(normals);
  });
});
