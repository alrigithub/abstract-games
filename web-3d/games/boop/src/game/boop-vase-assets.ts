export type BoopVasePlayerId = 'A' | 'B';
export type BoopVaseVariant = 'cat' | 'kitten';

/** Alex stone-mixed-final vase GLBs (internal root names match filenames). */
export const BOOP_VASE_GLB: Record<BoopVasePlayerId, Record<BoopVaseVariant, string>> = {
  A: {
    kitten: 'vase-small-white.glb',
    cat: 'vase-large-white.glb',
  },
  B: {
    kitten: 'vase-small-black.glb',
    cat: 'vase-large-black.glb',
  },
};

export function boopVaseGlbFor(player: BoopVasePlayerId, variant: BoopVaseVariant): string {
  return BOOP_VASE_GLB[player][variant];
}
