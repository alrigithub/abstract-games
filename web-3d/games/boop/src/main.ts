import {
  ANIMATION,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  createSquareTopology,
  BOOP_AI_STRENGTH_STORAGE_KEY,
  DEFAULT_AI_STRENGTH_LEVELS,
  levelToSearchOptions,
  createLoadingScreen,
  LOBBY_FONT_FAMILY,
  setActiveLoadingScreen,
  type SceneApi,
} from '@abstract/three-engine';
import { applyBoopAnimationPacing, BOOP_ANIM } from './game/animation';
import { cellAt, poolCellIndex, wireBoopInteraction, type BoopInteractionHandle } from './game/boop-interaction';
import { BOOP_CONTROL_ART_PX } from './game/boop-ring-ui';
import { BoopScreenMarker } from './game/boop-screen-marker';
import { createBoopSizeControl, type BoopSizeControlHandle } from './game/boop-size-control';
import { boardPlayfieldTopY } from './game/boop-grounding';
import { createBoopPieceGeometrySet } from './game/boop-stone-cats';
import { BOOP_DEMO_BOOP_SFX_URLS, BOOP_DEMO_PLACE_SFX_URLS } from './game/boop-sfx-manifest';
import { initBoopKnockPushSounds } from './game/boop-knock-sfx';
import { BoopController } from './game/controller';
import { BOOP_GRID as size, BOOP_OUTSIDE as OUTSIDE_ROWS } from './game/boop-grid';

applyBoopAnimationPacing(ANIMATION);
initBoopKnockPushSounds();

const loading = createLoadingScreen({ gameName: 'Boop' });
setActiveLoadingScreen(loading);

const fallbackCat = createBoopCatGeometry();
const fallbackKitten = createBoopKittenGeometry();
const pieces = await loading.track(
  createBoopPieceGeometrySet(fallbackCat, fallbackKitten),
  'Loading Boop vase piece models',
);
const topology = createSquareTopology({ size, outsideRows: OUTSIDE_ROWS });

const board = document.querySelector<HTMLDivElement>('#board')!;
injectBoopUiStyles();
const placementMarker = new BoopScreenMarker(board);

const scene = await loading.track(
  createBoardScene(board, {
  gridSize: size,
  outsideRows: OUTSIDE_ROWS,
  topology,
  pieces,
  playfieldSurfaceY: boardPlayfieldTopY(),
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
let sizeControl!: BoopSizeControlHandle;
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
    sizeControl?.setKind(kind);
    interaction?.refreshMarker();
  },
});

gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
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

sizeControl = createBoopSizeControl({
  mount: board,
  initialKind: controller.getStickyKind(),
  onKindChange: kind => controller.setStickyKind(kind),
});
await loading.track(controller.init(), 'Wiring Boop interaction');
mountBoardOverlays(board);
interaction = wireBoopInteraction(stage as HTMLElement, board, scene, () => controller, placementMarker);
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
  const sizeEl = boardEl.querySelector('[data-testid="boop-thumb-control"]');
  if (sizeEl) boardEl.appendChild(sizeEl);
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
    .boop-move-marker {
      position: absolute;
      left: 0;
      top: 0;
      pointer-events: none;
      z-index: 4;
      will-change: transform;
    }
    .boop-move-marker img {
      display: block;
      width: 100%;
      height: 100%;
    }
    .boop-size-control {
      position: absolute;
      left: max(16px, env(safe-area-inset-left, 0px));
      bottom: max(16px, env(safe-area-inset-bottom, 0px));
      z-index: 6;
      pointer-events: none;
    }
    .boop-size-control__button {
      pointer-events: auto;
      touch-action: manipulation;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: #2b2b28;
      font-family: ${LOBBY_FONT_FAMILY};
      font-weight: 600;
      font-size: 15px;
      line-height: 1.2;
      -webkit-tap-highlight-color: transparent;
    }
    .boop-size-control__button:active .boop-size-control__art {
      transform: scale(0.97);
    }
    .boop-size-control__button:focus-visible {
      outline: 2px solid #2b2b28;
      outline-offset: 4px;
      border-radius: 12px;
    }
    .boop-size-control__art {
      width: ${BOOP_CONTROL_ART_PX}px;
      height: ${BOOP_CONTROL_ART_PX}px;
      display: block;
    }
    .boop-size-control__art[hidden] {
      display: none !important;
    }
    .boop-size-control__label {
      user-select: none;
    }
  `;
  document.head.append(style);
}
