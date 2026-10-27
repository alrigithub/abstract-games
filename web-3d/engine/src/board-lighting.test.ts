import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyBoardLighting } from './board-lighting';
import { CLAY } from './constants';

function rendererStub() {
  return { shadowMap: {}, toneMappingExposure: .98 } as unknown as THREE.WebGLRenderer;
}

describe('runtime board lighting', () => {
  it('preserves existing defaults when no preset is requested', () => {
    const scene = new THREE.Scene();
    scene.environmentIntensity = .5;
    const renderer = rendererStub();
    const lighting = applyBoardLighting(scene, renderer);
    expect(lighting.light.intensity).toBe(CLAY.KEY_LIGHT_INTENSITY);
    expect(lighting.light.color.getHex()).toBe(CLAY.KEY_LIGHT_COLOR);
    expect(lighting.light.shadow.radius).toBe(CLAY.SHADOW_RADIUS);
    expect(scene.environmentIntensity).toBe(.5);
    expect(renderer.toneMappingExposure).toBe(.98);
    expect(scene.children.filter(node => node instanceof THREE.HemisphereLight)).toHaveLength(0);
    lighting.dispose();
  });

  it('applies initial and runtime settings without moving the sun or duplicating lights', () => {
    const scene = new THREE.Scene();
    const renderer = rendererStub();
    const lighting = applyBoardLighting(scene, renderer, {
      ambientFill: true, keyLightColor: '#ffffff', keyLightIntensity: 2.1,
      hemisphereIntensityLight: .28, environmentIntensity: .55, exposure: 1.05, shadowRadius: 5,
    });
    const position = lighting.light.position.clone();
    expect(scene.environmentIntensity).toBe(.55);
    expect(renderer.toneMappingExposure).toBe(1.05);
    expect(lighting.light.shadow.radius).toBe(5);
    lighting.update({
      keyLightColor: '#ffe1ba', keyLightIntensity: 1.8,
      hemisphereIntensityLight: .34, environmentIntensity: .65, shadowRadius: 8,
    });
    expect(lighting.light.color.getHex()).toBe(0xffe1ba);
    expect(lighting.light.intensity).toBe(1.8);
    expect(lighting.light.position.equals(position)).toBe(true);
    expect(scene.environmentIntensity).toBe(.65);
    expect(renderer.toneMappingExposure).toBe(1.05);
    const fills = scene.children.filter(node => node instanceof THREE.HemisphereLight);
    expect(fills).toHaveLength(1);
    expect((fills[0] as THREE.HemisphereLight).intensity).toBe(.34);
    lighting.refreshMapSize();
    expect(lighting.light.shadow.radius).toBe(8);
    lighting.update({ ambientFill: false });
    expect(fills[0]!.visible).toBe(false);
    lighting.update({ ambientFill: true });
    expect(scene.children.filter(node => node instanceof THREE.HemisphereLight)).toHaveLength(1);
    lighting.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
