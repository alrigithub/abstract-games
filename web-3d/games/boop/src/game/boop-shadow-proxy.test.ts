import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyGhostOpacity,
  clonePieceVisualTemplate,
  PIECE_SKIP_CAST_SHADOW_USER_DATA,
  tagPieceForShadows,
  tagPieceGlbMeshesForShadows,
} from '@abstract/three-engine';
import { enableVaseShadows, prepareBakedVaseGlb } from './boop-stone-cats';

describe('Boop baked vase shadows', () => {
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

  it.each(['white', 'black'])('preserves the %s baked map without relighting', color => {
    const map = new THREE.Texture();
    const source = new THREE.MeshBasicMaterial({ name: color, map, color: 0xcccccc });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    prepareBakedVaseGlb(mesh);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material).not.toBe(source);
    expect(material.isMeshBasicMaterial).toBe(true);
    expect(material.map).toBe(map);
    expect(material.color.getHex()).toBe(0xcccccc);
    expect(source.map).toBe(map);
  });

  it('uses only the baked color map if an export still has a lit material', () => {
    const map = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({ map, color: 0xcccccc });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    prepareBakedVaseGlb(mesh);
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((mesh.material as THREE.MeshBasicMaterial).map).toBe(map);
    expect(source.isMeshStandardMaterial).toBe(true);
  });
});
