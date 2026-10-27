export type BoopVasePlayerId = 'A' | 'B';
export type BoopVaseVariant = 'cat' | 'kitten';

/** Detailed PBR vase GLBs in web-3d/lib/pieces; source assets remain available separately. */
export const BOOP_VASE_GLB: Record<BoopVasePlayerId, Record<BoopVaseVariant, string>> = {
  A: {
    kitten: 'boop-vase-small-white-detail.glb',
    cat: 'boop-vase-large-white-detail.glb',
  },
  B: {
    kitten: 'boop-vase-small-black-detail.glb',
    cat: 'boop-vase-large-black-detail.glb',
  },
};

export function boopVaseGlbFor(player: BoopVasePlayerId, variant: BoopVaseVariant): string {
  return BOOP_VASE_GLB[player][variant];
}
