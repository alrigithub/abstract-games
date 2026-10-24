export type BoopVasePlayerId = 'A' | 'B';
export type BoopVaseVariant = 'cat' | 'kitten';

/** Alex stone vase GLBs in web-3d/lib/pieces (embedded 1024px maps; internal root names match filenames). */
export const BOOP_VASE_GLB: Record<BoopVasePlayerId, Record<BoopVaseVariant, string>> = {
  A: {
    kitten: 'boop-vase-small-white.glb',
    cat: 'boop-vase-large-white.glb',
  },
  B: {
    kitten: 'boop-vase-small-black.glb',
    cat: 'boop-vase-large-black.glb',
  },
};

export function boopVaseGlbFor(player: BoopVasePlayerId, variant: BoopVaseVariant): string {
  return BOOP_VASE_GLB[player][variant];
}
