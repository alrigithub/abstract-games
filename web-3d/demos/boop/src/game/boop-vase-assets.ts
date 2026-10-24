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

/** Expected byte sizes (Alex attachments); guards against swapped copies in public/assets/vases. */
export const BOOP_VASE_GLB_BYTE_SIZE: Record<string, number> = {
  'vase-small-white.glb': 2_154_856,
  'vase-large-white.glb': 2_264_936,
  'vase-small-black.glb': 3_331_300,
  'vase-large-black.glb': 3_781_380,
};

export function boopVaseGlbFor(player: BoopVasePlayerId, variant: BoopVaseVariant): string {
  return BOOP_VASE_GLB[player][variant];
}
