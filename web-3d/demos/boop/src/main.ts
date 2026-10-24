import {
  boopPieceGeometrySet,
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
import { BoopController } from './game/controller';

const size = 6;
const OUTSIDE_ROWS = 2;

const cat = createBoopCatGeometry();
const kitten = createBoopKittenGeometry();
const pieces = boopPieceGeometrySet(cat, kitten);
const topology = createSquareTopology({ size, outsideRows: OUTSIDE_ROWS });

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readInitialTheme();

const scene = await createBoardScene(board, {
  gridSize: size,
  topology,
  pieces,
  initialTheme: theme,
});

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
}

const cameraViews = scene.createCameraViews();

let controller!: BoopController;

const gameButtons = createGameButtons({
  mount: document.querySelector<HTMLElement>('#game-buttons-mount')!,
  cameraViews,
  applyTheme,
  aiStrengthStorageKey: BOOP_AI_STRENGTH_STORAGE_KEY,
  onAiStrengthChange: () => controller?.renderStatus(),
  onNewGameReset: () => controller.newGame(),
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
});

await controller.init();

wirePointerInput(board, scene, () => controller);

declare global {
  interface Window {
    __boopScene?: SceneApi;
    __boopSetTheme?: (theme: ThemeId) => void;
    __boopController?: BoopController;
  }
}

window.__boopScene = scene;
window.__boopController = controller;
window.__boopSetTheme = (id: ThemeId) => {
  storeTheme(id);
  applyTheme(id);
};

const params = new URLSearchParams(location.search);
const forcedTheme = params.get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  window.__boopSetTheme(forcedTheme);
}

function wirePointerInput(container: HTMLElement, sceneApi: SceneApi, getController: () => BoopController) {
  const canvas = container.querySelector('canvas');
  if (!canvas) return;
  let downX = 0;
  let downY = 0;
  let downCell: number | null = null;

  canvas.addEventListener('pointerdown', e => {
    downX = e.clientX;
    downY = e.clientY;
    downCell = sceneApi.hitTest(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', e => {
    if (downCell === null) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy > 64) return;
    const cell = sceneApi.hitTest(e.clientX, e.clientY);
    if (cell !== downCell) return;
    void getController().handleCellClick(cell);
    downCell = null;
  });
}
