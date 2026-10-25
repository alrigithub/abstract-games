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
await controller.init();
domContactShadows.start();
mountBoardOverlays(board);
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
    .boop-placement-ghost[data-theme='dark'] {
      --boop-accent: #5eead4;
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
      border: 3px solid color-mix(in srgb, var(--theme-ink, #292524) 82%, transparent);
      padding: 0;
      margin: 0;
      border-radius: 50%;
      background: transparent;
      filter: drop-shadow(0 2px 4px color-mix(in srgb, #000 22%, transparent));
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .boop-thumb-control[data-theme='dark'] .boop-thumb-control__size {
      border-color: color-mix(in srgb, var(--theme-ink, #fafaf9) 78%, transparent);
      filter: drop-shadow(0 2px 5px color-mix(in srgb, #000 50%, transparent));
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
    }
    .boop-thumb-control__size--cat {
      width: 64px;
      height: 64px;
      right: 0;
      top: 50%;
      translate: 0 -50%;
    }
    .boop-thumb-control__size--kitten::before,
    .boop-thumb-control__size--cat::before {
      content: '';
      position: absolute;
      inset: -10px;
    }
    .boop-thumb-control__size[data-selected='true'] {
      border-color: #0d9488;
      box-shadow: 0 0 0 3px color-mix(in srgb, #0d9488 38%, transparent);
    }
    .boop-thumb-control[data-theme='dark'] .boop-thumb-control__size[data-selected='true'] {
      border-color: #5eead4;
      box-shadow: 0 0 0 3px color-mix(in srgb, #5eead4 34%, transparent);
    }
    .boop-placement-ghost {
      border-width: 3px;
    }
  `;
  document.head.append(style);
}
