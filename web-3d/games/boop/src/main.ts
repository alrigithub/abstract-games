import {
  ANIMATION,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  DomPlacementGhost,
  BOOP_AI_STRENGTH_STORAGE_KEY,
  DEFAULT_AI_STRENGTH_LEVELS,
  levelToSearchOptions,
  readInitialTheme,
  storeTheme,
  type SceneApi,
  type ThemeId,
} from '@abstract/three-engine';
import { applyBoopAnimationPacing, BOOP_ANIM } from './game/animation';
import { cellAt, poolCellIndex, wireBoopInteraction, type BoopInteractionHandle } from './game/boop-interaction';
import { createBoopThumbControl, type BoopThumbControlHandle } from './game/boop-thumb-control';
import { boardPlayfieldTopY } from './game/boop-grounding';
import { createBoopPieceGeometrySet } from './game/boop-stone-cats';
import { BOOP_DEMO_BOOP_SFX_URLS, BOOP_DEMO_PLACE_SFX_URLS } from './game/boop-sfx-manifest';
import { initBoopKnockPushSounds } from './game/boop-knock-sfx';
import { BoopController } from './game/controller';
import {
  boopPlayfieldGroundSize,
  createBoopTopology,
  loadBoopArenaTemplate,
} from './game/boop-arena';
import { BOOP_GRID as size, BOOP_OUTSIDE as OUTSIDE_ROWS } from './game/boop-grid';
import { createBoopPrerenderTopology, loadBoopPrerender } from './game/boop-prerender';

applyBoopAnimationPacing(ANIMATION);
initBoopKnockPushSounds();

const fallbackCat = createBoopCatGeometry();
const fallbackKitten = createBoopKittenGeometry();
const prerender = new URLSearchParams(location.search).get('arena') === '3d' ? null : await loadBoopPrerender();
const pieces = await createBoopPieceGeometrySet(fallbackCat, fallbackKitten, prerender?.shadows);
const topology = prerender
  ? createBoopPrerenderTopology({ size, outsideRows: OUTSIDE_ROWS }, prerender.columns)
  : createBoopTopology({ size, outsideRows: OUTSIDE_ROWS }, await loadBoopArenaTemplate());

const board = document.querySelector<HTMLDivElement>('#board')!;
injectBoopUiStyles();
let theme: ThemeId = readInitialTheme();
const placementGhost = new DomPlacementGhost(board, {
  className: 'boop-placement-ghost',
  testId: 'boop-placement-ghost',
  theme,
});

const scene = await createBoardScene(board, {
  prerenderedArena: prerender?.plate,
  gridSize: size,
  outsideRows: OUTSIDE_ROWS,
  topology,
  pieces,
  initialTheme: theme,
  playfieldSurfaceY: boardPlayfieldTopY(),
  playfieldGround: {
    matchBackdrop: !!prerender,
    size: boopPlayfieldGroundSize(size, OUTSIDE_ROWS),
    surfaceColor: '#ffffff',
  },
  boardLighting: {
    ambientFill: true,
    keyLightIntensity: 1.72,
    hemisphereIntensityLight: 0.26,
    hemisphereIntensityDark: 0.3,
  },
  placeSfx: {
    place: BOOP_DEMO_PLACE_SFX_URLS,
    boop: BOOP_DEMO_BOOP_SFX_URLS,
  },
});

const stage = board.querySelector('canvas') ?? board;

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
  placementGhost.applyTheme(id);
  interaction?.setGhostTheme(id);
  thumbControl?.applyTheme(id);
}

const cameraViews = scene.createCameraViews();

let controller!: BoopController;
let interaction!: BoopInteractionHandle;
let thumbControl!: BoopThumbControlHandle;
let gameButtons!: ReturnType<typeof createGameButtons>;

controller = new BoopController({
  scene,
  setStatus: t => gameButtons?.setStatus(t),
  getAiSearchOptions: () => {
    const ai = gameButtons?.aiStrength;
    return ai ? levelToSearchOptions(ai.getLevel()) : levelToSearchOptions(DEFAULT_AI_STRENGTH_LEVELS[1]!);
  },
  onReady: () => {
    board.dataset.ready = 'true';
  },
  onStickyKindChange: kind => {
    thumbControl?.setKind(kind);
  },
});

gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews: prerender ? undefined : cameraViews,
  applyTheme,
  aiStrengthStorageKey: BOOP_AI_STRENGTH_STORAGE_KEY,
  onAiStrengthChange: () => controller.renderStatus(),
  onNewGameReset: () => {
    interaction.cancel();
    controller.newGame();
  },
  onRestartRound: () => {
    interaction.cancel();
    controller.newGame();
  },
});

thumbControl = createBoopThumbControl({
  mount: board,
  initialKind: controller.getStickyKind(),
  theme,
  onKindChange: kind => controller.setStickyKind(kind),
});
await controller.init();
interaction = wireBoopInteraction(stage as HTMLElement, board, scene, () => controller, placementGhost);
controller.setAiPlaceTap((from, to) => interaction.tapPlaceOnBed(from, to, { ai: true }));

window.__boopController = controller;

declare global {
  interface Window {
    __boopScene?: SceneApi;
    __boopSetTheme?: (theme: ThemeId) => void;
    __boopController?: BoopController;
    __boopSmokePickAndPlace?: () => Promise<void>;
    __boopAssertGrounding?: () => { ok: boolean; maxGap: number; boardTop: number; bases: number[] };
    __boopSetScreenshotCamera?: () => void;
    __boopSetCameraPreset?: (preset: 'top' | 'axo') => void;
    __boopStageShowcase?: () => void;
    __boopPlayToHumanFirstGraduation?: () => Promise<boolean>;
    __boopStageHumanGraduation?: () => void;
    __boopPlaceHumanGraduationLine?: (options?: { scheduleAi?: boolean }) => Promise<boolean>;
    __boopAssistStats?: () => ReturnType<SceneApi['getBoardAssistStats']>;
    __boopPreviewGhost?: (kind: 'kitten' | 'cat', row: number, col: number) => void;
  }
}

window.__boopScene = scene;
window.__boopSmokePickAndPlace = async () => {
  await interaction.tapPlaceOnBed(poolCellIndex(), cellAt(2, 2));
  await new Promise(r => setTimeout(r, BOOP_ANIM.MOVE_MS + BOOP_ANIM.STEP_GAP_MS + 120));
};

window.__boopAssertGrounding = () => {
  const boardTop = scene.getBoardTopY();
  const bases = scene.getStackBottomBaseYs(!!prerender);
  const maxGap = bases.length ? Math.max(...bases.map(b => Math.abs(b - boardTop))) : 0;
  return { ok: maxGap <= 0.001, maxGap, boardTop, bases };
};

window.__boopSetCameraPreset = preset => {
  cameraViews.setPreset(preset, false);
  cameraViews.refit();
};

window.__boopStageShowcase = () => {
  controller.stageShowcaseForScreenshots();
};

window.__boopPlayToHumanFirstGraduation = () => controller.playToHumanFirstGraduation();
window.__boopStageHumanGraduation = () => controller.stageHumanGraduationSetup();
window.__boopPlaceHumanGraduationLine = options => controller.placeHumanGraduationLine(options);
window.__boopAssistStats = () => scene.getBoardAssistStats();

window.__boopPreviewGhost = (kind, row, col) => {
  controller.setStickyKind(kind);
  interaction.previewGhostAt(cellAt(row, col), kind);
};

window.__boopSetScreenshotCamera = () => {
  const canvas = board.querySelector('canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 0, bubbles: true }));
  canvas.dispatchEvent(
    new PointerEvent('pointermove', { clientX: cx + rect.width * 0.15, clientY: cy + rect.height * 0.22, button: 0, bubbles: true }),
  );
  canvas.dispatchEvent(
    new PointerEvent('pointerup', { clientX: cx + rect.width * 0.15, clientY: cy + rect.height * 0.22, button: 0, bubbles: true }),
  );
};

window.__boopSetTheme = (id: ThemeId) => {
  storeTheme(id);
  applyTheme(id);
};

const params = new URLSearchParams(location.search);
const forcedTheme = params.get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  window.__boopSetTheme(forcedTheme);
}

function injectBoopUiStyles() {
  if (document.getElementById('boop-demo-ui')) return;
  const style = document.createElement('style');
  style.id = 'boop-demo-ui';
  style.textContent = `
    #board {
      position: relative;
    }
    .game-button-status:empty {
      display: none;
    }
    .boop-placement-ghost {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      box-sizing: border-box;
      z-index: 2;
      border: 2px solid color-mix(in srgb, var(--theme-ink, #1c1917) 22%, transparent);
      background:
        radial-gradient(circle at 50% 62%, color-mix(in srgb, var(--theme-ink, #1c1917) 16%, transparent) 0%, transparent 68%),
        color-mix(in srgb, var(--theme-surface, #fff) 72%, transparent);
      box-shadow:
        0 1px 0 color-mix(in srgb, #fff 40%, transparent) inset,
        0 4px 14px color-mix(in srgb, var(--theme-ink, #000) 14%, transparent);
    }
    .boop-placement-ghost[data-theme='dark'] {
      border-color: color-mix(in srgb, var(--theme-ink, #f5f5f4) 28%, transparent);
      background:
        radial-gradient(circle at 50% 62%, color-mix(in srgb, #000 24%, transparent) 0%, transparent 68%),
        color-mix(in srgb, var(--theme-surface, #0c0a09) 55%, transparent);
    }
    .boop-thumb-control {
      position: absolute;
      left: max(12px, env(safe-area-inset-left, 0px));
      bottom: max(12px, env(safe-area-inset-bottom, 0px));
      width: clamp(112px, 22vw, 136px);
      height: clamp(112px, 22vw, 136px);
      z-index: 4;
      pointer-events: none;
    }
    .boop-thumb-control__ring {
      position: absolute;
      inset: 18%;
      border-radius: 50%;
      pointer-events: none;
      border: 2px solid color-mix(in srgb, var(--theme-ink, #1c1917) 18%, transparent);
      background:
        radial-gradient(circle at 50% 65%, color-mix(in srgb, var(--theme-ink, #1c1917) 12%, transparent), transparent 70%),
        color-mix(in srgb, var(--theme-surface, #fff) 88%, transparent);
      box-shadow:
        0 8px 24px color-mix(in srgb, var(--theme-ink, #000) 12%, transparent),
        0 1px 0 color-mix(in srgb, #fff 50%, transparent) inset;
      transform: scale(var(--boop-thumb-footprint, 0.68));
      transition: transform 160ms ease;
    }
    .boop-thumb-control[data-theme='dark'] .boop-thumb-control__ring {
      border-color: color-mix(in srgb, var(--theme-ink, #fafaf9) 22%, transparent);
      background:
        radial-gradient(circle at 50% 65%, color-mix(in srgb, #000 20%, transparent), transparent 70%),
        color-mix(in srgb, var(--theme-surface, #0c0a09) 78%, transparent);
    }
    .boop-thumb-control__size {
      position: absolute;
      pointer-events: auto;
      border: none;
      padding: 0;
      margin: 0;
      border-radius: 50%;
      background: color-mix(in srgb, var(--theme-surface, #fff) 92%, var(--theme-ink, #000) 8%);
      box-shadow: 0 2px 10px color-mix(in srgb, var(--theme-ink, #000) 10%, transparent);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .boop-thumb-control__size:active {
      transform: scale(0.96);
    }
    .boop-thumb-control__size--kitten {
      width: 38%;
      height: 38%;
      left: 8%;
      top: 50%;
      translate: 0 -50%;
    }
    .boop-thumb-control__size--cat {
      width: 46%;
      height: 46%;
      right: 6%;
      top: 50%;
      translate: 0 -50%;
    }
    .boop-thumb-control__size::after {
      content: '';
      position: absolute;
      inset: 22%;
      border-radius: 50%;
      background: linear-gradient(
        165deg,
        color-mix(in srgb, var(--theme-ink, #444) 8%, #fff) 0%,
        color-mix(in srgb, var(--theme-ink, #444) 22%, #d6d3d1) 100%
      );
      box-shadow: inset 0 -2px 4px color-mix(in srgb, #000 12%, transparent);
    }
    .boop-thumb-control__size--cat::after {
      inset: 18%;
    }
    .boop-thumb-control[data-theme='dark'] .boop-thumb-control__size::after {
      background: linear-gradient(
        165deg,
        color-mix(in srgb, var(--theme-ink, #fafaf9) 12%, #444) 0%,
        color-mix(in srgb, var(--theme-ink, #fafaf9) 6%, #1c1917) 100%
      );
    }
    .boop-thumb-control__size[data-selected='true'] {
      box-shadow:
        0 0 0 2px color-mix(in srgb, var(--theme-win, #3b82f6) 70%, transparent),
        0 4px 16px color-mix(in srgb, var(--theme-ink, #000) 16%, transparent);
    }
  `;
  document.head.append(style);
}
