import {
  ANIMATION,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  DomPlacementGhost,
  BOOP_AI_STRENGTH_STORAGE_KEY,
  ARENA_GLB_SURFACE_COLOR,
  DEFAULT_AI_STRENGTH_LEVELS,
  levelToSearchOptions,
  createLoadingScreen,
  setActiveLoadingScreen,
  type SceneApi,
} from '@abstract/three-engine';
import { applyBoopAnimationPacing, BOOP_ANIM } from './game/animation';
import { cellAt, poolCellIndex, wireBoopInteraction, type BoopInteractionHandle } from './game/boop-interaction';
import { createBoopThumbControl, type BoopThumbControlHandle } from './game/boop-thumb-control';
import { boardPlayfieldTopY } from './game/boop-grounding';
import { createBoopPieceGeometrySet } from './game/boop-stone-cats';
import { BOOP_DEMO_BOOP_SFX_URLS, BOOP_DEMO_PLACE_SFX_URLS } from './game/boop-sfx-manifest';
import { initBoopKnockPushSounds } from './game/boop-knock-sfx';
import { BoopController } from './game/controller';
import { BOOP_GRID as size, BOOP_OUTSIDE as OUTSIDE_ROWS } from './game/boop-grid';
import { boopPlayfieldGroundSize, createBoopPrerenderTopology, loadBoopPrerender } from './game/boop-prerender';
import { BOOP_LIGHTING_PRESETS, loadBoopLightingTexture, mountBoopLightingMenu, readBoopLighting } from './game/boop-lighting';

applyBoopAnimationPacing(ANIMATION);
initBoopKnockPushSounds();

const loading = createLoadingScreen({ gameName: 'Boop' });
setActiveLoadingScreen(loading);

const fallbackCat = createBoopCatGeometry();
const fallbackKitten = createBoopKittenGeometry();
const lightingPreset = readBoopLighting();
const prerender = await loading.track(
  loadBoopPrerender(lightingPreset),
  'Loading Boop prerender plate (textures + columns GLB)',
);
const pieces = await loading.track(
  createBoopPieceGeometrySet(fallbackCat, fallbackKitten, prerender.shadows),
  'Loading Boop vase piece models',
);
const topology = createBoopPrerenderTopology({ size, outsideRows: OUTSIDE_ROWS }, prerender.columns);

const board = document.querySelector<HTMLDivElement>('#board')!;
injectBoopUiStyles();
const placementGhost = new DomPlacementGhost(board, {
  className: 'boop-placement-ghost',
  testId: 'boop-placement-ghost',
});

const scene = await loading.track(
  createBoardScene(board, {
  prerenderedArena: prerender.plate,
  gridSize: size,
  outsideRows: OUTSIDE_ROWS,
  topology,
  pieces,
  playfieldSurfaceY: boardPlayfieldTopY(),
  playfieldGround: {
    matchBackdrop: true,
    size: boopPlayfieldGroundSize(size, OUTSIDE_ROWS),
    surfaceColor: ARENA_GLB_SURFACE_COLOR,
  },
  boardLighting: BOOP_LIGHTING_PRESETS[lightingPreset].live,
  placeSfx: {
    place: BOOP_DEMO_PLACE_SFX_URLS,
    boop: BOOP_DEMO_BOOP_SFX_URLS,
  },
}),
  'Starting board scene (WebGL + placement audio)',
);

mountBoardOverlays(board);

const stage = board.querySelector('canvas') ?? board;

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
mountBoopLightingMenu(gameButtons.root, lightingPreset, async id => {
  const texture = await loadBoopLightingTexture(id);
  scene.setPrerenderedTexture(texture);
  scene.setLighting(BOOP_LIGHTING_PRESETS[id].live);
});

thumbControl = createBoopThumbControl({
  mount: board,
  initialKind: controller.getStickyKind(),
  onKindChange: kind => controller.setStickyKind(kind),
});
await loading.track(controller.init(), 'Wiring Boop interaction');
mountBoardOverlays(board);
interaction = wireBoopInteraction(stage as HTMLElement, board, scene, () => controller, placementGhost);
await loading.done();
setActiveLoadingScreen(null);
controller.setAiPlaceTap((from, to) => interaction.tapPlaceOnBed(from, to, { ai: true }));

window.__boopController = controller;

declare global {
  interface Window {
    __boopScene?: SceneApi;
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
  const bases = scene.getStackBottomBaseYs(true);
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

function mountBoardOverlays(boardEl: HTMLElement) {
  const canvas = boardEl.querySelector('canvas');
  if (canvas instanceof HTMLElement) {
    canvas.style.position = 'relative';
    canvas.style.zIndex = '0';
  }
  const ghostEl = boardEl.querySelector('[data-testid="boop-placement-ghost"]');
  if (ghostEl) boardEl.appendChild(ghostEl);
  const thumbEl = boardEl.querySelector('[data-testid="boop-thumb-control"]');
  if (thumbEl) boardEl.appendChild(thumbEl);
}

function injectBoopUiStyles() {
  if (document.getElementById('boop-demo-ui')) return;
  const style = document.createElement('style');
  style.id = 'boop-demo-ui';
  style.textContent = `
    #board {
      position: relative;
      overflow: visible;
    }
    #board > canvas {
      display: block;
      position: relative;
      z-index: 0;
    }
    .game-button-status:empty {
      display: none;
    }
    .boop-placement-ghost {
      --boop-accent: #0d9488;
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      box-sizing: border-box;
      z-index: 3;
      border: 2.5px solid var(--boop-accent);
      background: transparent;
    }
    .boop-thumb-control {
      position: absolute;
      left: max(14px, env(safe-area-inset-left, 0px));
      bottom: max(14px, env(safe-area-inset-bottom, 0px));
      width: clamp(132px, 26vw, 168px);
      height: 80px;
      z-index: 5;
      pointer-events: none;
    }
    .boop-thumb-control__size {
      position: absolute;
      pointer-events: auto;
      box-sizing: border-box;
      border: 1px solid var(--game-btn-border, #d4d4d8);
      padding: 0;
      margin: 0;
      border-radius: 50%;
      background: var(--game-btn-bg, #fff);
      color: inherit;
      box-shadow: 0 1px 2px rgba(26, 26, 26, 0.12);
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .boop-thumb-control__size:active {
      transform: scale(0.96);
    }
    .boop-thumb-control__size--kitten {
      width: 36px;
      height: 36px;
      left: 4px;
      top: 50%;
      translate: 0 -50%;
      background: radial-gradient(circle, #d6d3d1 0 34%, #fff 36%);
    }
    .boop-thumb-control__size--cat {
      width: 64px;
      height: 64px;
      right: 0;
      top: 50%;
      translate: 0 -50%;
      background: radial-gradient(circle, #d6d3d1 0 38%, #fff 40%);
    }
    .boop-thumb-control__size--kitten::before,
    .boop-thumb-control__size--cat::before {
      content: '';
      position: absolute;
      inset: -10px;
    }
    .boop-thumb-control__size[data-selected='true'] {
      border-color: #0d9488;
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.35);
    }
    .boop-placement-ghost {
      border-width: 3px;
    }
  `;
  document.head.append(style);
}
