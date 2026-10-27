export type BoopVasePlayerId = 'A' | 'B';
export type BoopVaseVariant = 'cat' | 'kitten';

/** Baked low-poly vase GLBs in web-3d/lib/pieces; source assets remain available separately. */
export const BOOP_VASE_GLB: Record<BoopVasePlayerId, Record<BoopVaseVariant, string>> = {
  A: {
    kitten: 'boop-vase-small-white-baked.glb',
    cat: 'boop-vase-large-white-baked.glb',
  },
  B: {
    kitten: 'boop-vase-small-black-baked.glb',
    cat: 'boop-vase-large-black-baked.glb',
  },
};

export function boopVaseGlbFor(player: BoopVasePlayerId, variant: BoopVaseVariant): string {
  return BOOP_VASE_GLB[player][variant];
}
