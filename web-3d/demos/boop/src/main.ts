import {
  ANIMATION,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  createSquareTopology,
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
import { boardPlayfieldTopY } from './game/boop-grounding';
import { createBoopPieceGeometrySet } from './game/boop-stone-cats';
import { BOOP_DEMO_BOOP_SFX_URLS, BOOP_DEMO_PLACE_SFX_URLS } from './game/boop-sfx-manifest';
import { BoopController } from './game/controller';
import { BOOP_GRID as size, BOOP_OUTSIDE as OUTSIDE_ROWS } from './game/boop-grid';

applyBoopAnimationPacing(ANIMATION);

const fallbackCat = createBoopCatGeometry();
const fallbackKitten = createBoopKittenGeometry();
const pieces = await createBoopPieceGeometrySet(fallbackCat, fallbackKitten);
const topology = createSquareTopology({ size, outsideRows: OUTSIDE_ROWS });

const board = document.querySelector<HTMLDivElement>('#board')!;
injectBoopUiStyles();
let theme: ThemeId = readInitialTheme();
const placementGhost = new DomPlacementGhost(board, {
  className: 'boop-placement-ghost',
  testId: 'boop-placement-ghost',
  theme,
});

const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: theme,
  playfieldSurfaceY: boardPlayfieldTopY(),
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
}

const cameraViews = scene.createCameraViews();

let controller!: BoopController;
let interaction!: BoopInteractionHandle;
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
});

gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  applyTheme,
  aiStrengthStorageKey: BOOP_AI_STRENGTH_STORAGE_KEY,
  gameActions: [
    {
      testId: 'boop-size-kitten',
      label: 'Small',
      title: 'Place kittens (small pieces)',
      ariaLabel: 'Select kitten for placement',
      className: 'game-action-button',
      onClick: () => interaction.setStickyKind('kitten'),
    },
    {
      testId: 'boop-size-cat',
      label: 'Big',
      title: 'Place cats (big pieces)',
      ariaLabel: 'Select cat for placement',
      className: 'game-action-button',
      onClick: () => interaction.setStickyKind('cat'),
    },
  ],
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
  const bases = scene.getStackBottomBaseYs();
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
    [data-testid="board"][data-win-line] {
      transition: filter 0.45s ease-in-out;
      filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.45));
    }
    [data-testid='boop-size-kitten'][data-selected='true'],
    [data-testid='boop-size-cat'][data-selected='true'] {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
      background: color-mix(in srgb, var(--game-button-bg, #fff) 85%, #3b82f6);
    }
    .boop-placement-ghost {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 2px dashed rgba(59, 130, 246, 0.75);
      background: rgba(59, 130, 246, 0.12);
      box-sizing: border-box;
      z-index: 2;
    }
    .boop-placement-ghost[data-theme='dark'] {
      border-color: rgba(147, 197, 253, 0.85);
      background: rgba(147, 197, 253, 0.14);
    }
  `;
  document.head.append(style);
}
