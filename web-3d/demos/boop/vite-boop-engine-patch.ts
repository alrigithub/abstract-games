import type { Plugin } from 'vite';

/** Boop-demo-only patches to shared board scene: initial snapshot + reframe on updates. */
export function boopEnginePatch(): Plugin {
  return {
    name: 'boop-engine-patch',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').includes('/engine/src/board-scene.ts')) return;

      let next = code;
      if (!next.includes('initialSnapshot?: BoardSnapshot')) {
        next = next.replace(
          'initialTheme?: ThemeId;',
          'initialTheme?: ThemeId;\n  /** Snapshot applied before the first camera fit (Boop demo side pools). */\n  initialSnapshot?: BoardSnapshot;',
        );
        next = next.replace(
          'let snapshot: BoardSnapshot = { playableCells: options.gridSize ** 2, cellCount: options.gridSize ** 2, cells: [] };',
          'let snapshot: BoardSnapshot =\n    options.initialSnapshot ??\n    ({ playableCells: options.gridSize ** 2, cellCount: options.gridSize ** 2, cells: [] });',
        );
      }

      if (!next.includes('BOOP_EXTERIOR_FRAMING')) {
        next = next.replace(
          `    for (const slot of snapshot.reserves ?? []) {
      const top = stackHeight(Array.from({ length: slot.count }, () => ({ shape: slot.shape, id: 'x', player: slot.player })), p => height(p as never)) + 0.025;
      for (const dx of [-0.43, 0.43]) for (const dz of [-0.43, 0.43]) {
        points.push(new THREE.Vector3(slot.position.x + dx, 0, slot.position.z + dz), new THREE.Vector3(slot.position.x + dx, top, slot.position.z + dz));
      }
    }`,
          `    for (const slot of snapshot.reserves ?? []) {
      const top = stackHeight(Array.from({ length: slot.count }, () => ({ shape: slot.shape, id: 'x', player: slot.player })), p => height(p as never)) + 0.025;
      for (const dx of [-0.43, 0.43]) for (const dz of [-0.43, 0.43]) {
        points.push(new THREE.Vector3(slot.position.x + dx, 0, slot.position.z + dz), new THREE.Vector3(slot.position.x + dx, top, slot.position.z + dz));
      }
    }
    /* BOOP_EXTERIOR_FRAMING */
    for (let index = snapshot.playableCells; index < snapshot.cells.length; index++) {
      const stack = snapshot.cells[index] ?? [];
      if (!stack.length) continue;
      const pos = cellPosition(index);
      const top = stackHeight(stack, p => height(p as never)) + 0.025;
      for (const dx of [-0.43, 0.43]) for (const dz of [-0.43, 0.43]) {
        points.push(new THREE.Vector3(pos.x + dx, 0, pos.z + dz), new THREE.Vector3(pos.x + dx, top, pos.z + dz));
      }
    }`,
        );
        next = next.replace(
          'const halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect)) * CAMERA.framePadding;',
          'const halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * aspect)) * Math.max(CAMERA.framePadding, 1.38);',
        );
      }

      if (!next.includes('fit(true);\n    updateInteraction();\n  }\n\n  const resizeObserver')) {
        next = next.replace(
          '    updateInteraction();\n  }\n\n  const resizeObserver',
          '    fit(true);\n    updateInteraction();\n  }\n\n  const resizeObserver',
        );
      }

      return next;
    },
  };
}
