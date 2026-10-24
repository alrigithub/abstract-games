import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { attachShadowStandIn } from './boop-stone-cats';

describe('Boop world-scale shadow proxies', () => {
  it('does not apply the vase scale twice and preserves non-pickable status in clones', () => {
    const vase = new THREE.Group();
    vase.scale.setScalar(30);
    vase.position.y = .6;
    vase.add(new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .04), new THREE.MeshBasicMaterial()));
    const geometry = new THREE.CylinderGeometry(.3, .3, 1.2);
    geometry.translate(0, .6, 0);
    attachShadowStandIn(vase, geometry);
    const clone = vase.clone(true);
    clone.updateMatrixWorld(true);
    const shadow = clone.children.find(node => node.userData.excludeFromPicking);
    expect(shadow).toBeDefined();
    if (!shadow) throw new Error('Missing shadow proxy');
    const bounds = new THREE.Box3().setFromObject(shadow);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(1.2);
    expect(bounds.max.x).toBeCloseTo(.3);
    expect(shadow.castShadow).toBe(true);
  });
});
