import {
  ANIMATION,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  createSquareTopology,
  BOOP_AI_STRENGTH_STORAGE_KEY,
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
import { BoopController } from './game/controller';

applyBoopAnimationPacing(ANIMATION);

const size = 6;
const OUTSIDE_ROWS = 2;

const fallbackCat = createBoopCatGeometry();
const fallbackKitten = createBoopKittenGeometry();
const pieces = await createBoopPieceGeometrySet(fallbackCat, fallbackKitten);
const topology = createSquareTopology({ size, outsideRows: OUTSIDE_ROWS });

const board = document.querySelector<HTMLDivElement>('#board')!;
injectBoopUiStyles();
let theme: ThemeId = readInitialTheme();

const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: theme,
  playfieldSurfaceY: boardPlayfieldTopY(),
});

const stage = board.querySelector('canvas') ?? board;

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
}

const cameraViews = scene.createCameraViews();

let controller!: BoopController;
let interaction!: BoopInteractionHandle;

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  applyTheme,
  aiStrengthStorageKey: BOOP_AI_STRENGTH_STORAGE_KEY,
  onAiStrengthChange: () => controller?.renderStatus(),
  onNewGameReset: () => {
    interaction.cancel();
    controller.newGame();
  },
  onRestartRound: () => {
    interaction.cancel();
    controller.newGame();
  },
});

controller = new BoopController({
  scene,
  setStatus: t => gameButtons.setStatus(t),
  getAiDepth: () => {
    const ai = gameButtons.aiStrength;
    return ai ? levelToSearchOptions(ai.getLevel()).maxDepth : 4;
  },
  onReady: () => {
    board.dataset.ready = 'true';
  },
  aiPlaceDrag: (from, to) => interaction.dragCellToCell(from, to, { ai: true }),
});

interaction = wireBoopInteraction(stage as HTMLElement, board, scene, () => controller);

await controller.init();

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
  }
}

window.__boopScene = scene;
window.__boopController = controller;
window.__boopSmokePickAndPlace = async () => {
  await interaction.dragCellToCell(poolCellIndex(), cellAt(2, 2));
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
  `;
  document.head.append(style);
}
