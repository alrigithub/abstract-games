import {
  ANIMATION,
  createBoardScene,
  createBoopCatGeometry,
  createBoopKittenGeometry,
  createGameButtons,
  BOOP_AI_STRENGTH_STORAGE_KEY,
  DEFAULT_AI_STRENGTH_LEVELS,
  levelToSearchOptions,
  readInitialTheme,
  storeTheme,
  createLoadingScreen,
  setActiveLoadingScreen,
  type SceneApi,
  type ThemeId,
} from '@abstract/three-engine';
import { applyBoopAnimationPacing, BOOP_ANIM } from './game/animation';
import { cellAt, poolCellIndex, wireBoopInteraction, type BoopInteractionHandle } from './game/boop-interaction';
import { BoopPlacementGhost } from './game/boop-placement-ghost';
import { createBoopThumbControl, type BoopThumbControlHandle } from './game/boop-thumb-control';
import { boardPlayfieldTopY } from './game/boop-grounding';
import { createBoopDomContactShadows } from './game/boop-dom-contact-shadows';
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

const loading = createLoadingScreen({ gameName: 'Boop' });
setActiveLoadingScreen(loading);

const fallbackCat = createBoopCatGeometry();
const fallbackKitten = createBoopKittenGeometry();
const prerender =
  new URLSearchParams(location.search).get('arena') === '3d'
    ? null
    : await loading.track(loadBoopPrerender(), 'Loading Boop prerender plate (textures + columns GLB)');
const pieces = await loading.track(
  createBoopPieceGeometrySet(fallbackCat, fallbackKitten, prerender?.shadows),
  'Loading Boop vase piece models',
);
const topology = prerender
  ? createBoopPrerenderTopology({ size, outsideRows: OUTSIDE_ROWS }, prerender.columns)
  : createBoopTopology(
      { size, outsideRows: OUTSIDE_ROWS },
      await loading.track(loadBoopArenaTemplate(), 'Loading arena map (boop-map.glb)'),
    );

const board = document.querySelector<HTMLDivElement>('#board')!;
injectBoopUiStyles();
let theme: ThemeId = readInitialTheme();
const placementGhost = new BoopPlacementGhost(board, {
  testId: 'boop-placement-ghost',
  theme,
});

const scene = await loading.track(
  createBoardScene(board, {
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
}),
  'Starting board scene (WebGL + placement audio)',
);

mountBoardOverlays(board);

const domContactShadows = createBoopDomContactShadows({
  board,
  scene,
  getSnapshot: () => controller?.getSnapshot() ?? { cellCount: 0, playableCells: 0, cells: [] },
  getTheme: () => theme,
});

const stage = board.querySelector('canvas') ?? board;

function applyTheme(id: ThemeId) {
  theme = id;
  scene.setTheme(id);
  placementGhost.applyTheme(id);
  interaction?.setGhostTheme(id);
  thumbControl?.applyTheme(id);
  domContactShadows.sync();
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
await loading.track(controller.init(), 'Wiring Boop interaction');
domContactShadows.start();
mountBoardOverlays(board);
interaction = wireBoopInteraction(stage as HTMLElement, board, scene, () => controller, placementGhost);
await loading.done();
setActiveLoadingScreen(null);
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

function mountBoardOverlays(boardEl: HTMLElement) {
  const canvas = boardEl.querySelector('canvas');
  if (canvas instanceof HTMLElement) {
    canvas.style.position = 'relative';
    canvas.style.zIndex = '0';
  }
  const ghostEl = boardEl.querySelector('[data-testid="boop-placement-ghost"]');
  if (ghostEl) boardEl.appendChild(ghostEl);
  const contactLayer = boardEl.querySelector('[data-testid="boop-dom-contact-shadows"]');
  if (contactLayer) boardEl.appendChild(contactLayer);
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
    .boop-dom-contact-shadows {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      overflow: visible;
    }
    .boop-dom-contact-shadow {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(12, 10, 8, 0.48) 0%,
        rgba(12, 10, 8, 0.32) 40%,
        rgba(12, 10, 8, 0.12) 68%,
        transparent 84%
      );
    }
    .boop-dom-contact-shadows[data-theme='dark'] .boop-dom-contact-shadow {
      background: radial-gradient(
        circle,
        rgba(0, 0, 0, 0.55) 0%,
        rgba(0, 0, 0, 0.32) 38%,
        rgba(0, 0, 0, 0.12) 62%,
        transparent 78%
      );
    }
    .game-button-status:empty {
      display: none;
    }
    .boop-placement-ghost {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
      z-index: 3;
      box-sizing: border-box;
    }
    .boop-placement-ghost__halo {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1px solid color-mix(in srgb, #b9fe8e 42%, transparent);
      box-sizing: border-box;
      pointer-events: none;
    }
    .boop-placement-ghost__ring {
      position: absolute;
      inset: 0;
      filter: drop-shadow(0 4px 12px color-mix(in srgb, #000 25%, transparent));
    }
    .boop-placement-ghost__ring-svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .boop-placement-ghost__vase {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(
        circle at 50% 38%,
        color-mix(in srgb, #1a1814 55%, transparent) 0%,
        color-mix(in srgb, #0c0a08 40%, transparent) 72%
      );
      pointer-events: none;
    }
    .boop-thumb-control {
      position: absolute;
      left: max(14px, env(safe-area-inset-left, 0px));
      bottom: max(14px, env(safe-area-inset-bottom, 0px));
      z-index: 5;
      pointer-events: none;
    }
    .boop-thumb-control__toggle {
      position: relative;
      pointer-events: auto;
      width: clamp(72px, 14vw, 88px);
      height: clamp(72px, 14vw, 88px);
      padding: 0;
      margin: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      filter: drop-shadow(0 4px 12px color-mix(in srgb, #000 25%, transparent));
      transition: transform 120ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .boop-thumb-control__toggle {
        transition: none;
      }
    }
    .boop-thumb-control__toggle:focus {
      outline: none;
    }
    .boop-thumb-control__toggle:focus-visible {
      outline: 3px solid color-mix(in srgb, #314000 65%, #b9fe8e);
      outline-offset: 4px;
    }
    .boop-thumb-control__toggle:active {
      transform: scale(0.96);
    }
    .boop-thumb-control__rings {
      display: block;
      width: 100%;
      height: 100%;
    }
    .boop-thumb-control__halo {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 38%;
      height: 38%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 3px solid transparent;
      box-sizing: border-box;
      pointer-events: none;
      opacity: 0;
      transition: opacity 160ms ease, border-color 160ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .boop-thumb-control__halo {
        transition: none;
      }
    }
    .boop-thumb-control__halo--visible {
      opacity: 1;
      border-color: color-mix(in srgb, #b9fe8e 35%, transparent);
    }
  `;
  document.head.append(style);
}
