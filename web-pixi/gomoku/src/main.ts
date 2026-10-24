import {
  AnimatedBackground,
  WinLineEffects,
  bindAiStrengthHud,
  createPixiStage,
  fitCamera,
} from "@abstract/pixi-shared";
import { BOARD_SIZE } from "./engine";
import { CELL, intersectionToWorld } from "./board/coords";
import { createGomokuBoardLayer } from "./board/gomoku-board";
import { GomokuSession, computeWinLine } from "./game-session";

async function main() {
  const mount = document.getElementById("app");
  const statusEl = document.getElementById("status");
  const depthEl = document.getElementById("ai-depth");
  const decBtn = document.getElementById("ai-dec");
  const incBtn = document.getElementById("ai-inc");
  if (!mount || !statusEl || !depthEl || !decBtn || !incBtn) {
    throw new Error("Missing DOM nodes");
  }

  bindAiStrengthHud({
    depthEl,
    decBtn,
    incBtn,
    onChange: () => {
      /* TS heuristic AI — strength HUD reserved for future depth search */
    },
  });

  const session = new GomokuSession();
  const stage = await createPixiStage(mount, { backgroundAlpha: 0 });
  const bg = new AnimatedBackground();
  stage.app.stage.addChildAt(bg, 0);

  const span = CELL * (BOARD_SIZE - 1);
  stage.setCamera(
    fitCamera(
      { width: span, height: span },
      { width: stage.app.screen.width, height: stage.app.screen.height },
      0.9,
    ),
  );

  const winFx = new WinLineEffects();
  stage.world.addChild(winFx);

  const boardLayer = createGomokuBoardLayer(stage.world, {
    onPlace: (x, y) => session.placeAt(x, y),
  });

  stage.app.ticker.add((t) => {
    bg.update(
      t.deltaMS,
      stage.app.screen.width,
      stage.app.screen.height,
    );
    winFx.update(t.deltaMS);
  });

  session.onUpdate(({ board, status, lastMove, winLine, statusText, aiThinking }) => {
    statusEl.textContent = statusText;
    const toMove =
      status.kind === "playing" && !aiThinking ? status.toMove : null;
    const interactive =
      status.kind === "playing" && toMove === "black" && !aiThinking;
    const line = winLine ?? computeWinLine(board);
    boardLayer.update({
      board,
      toMove,
      interactive,
      winLine: line,
      lastMove,
    });

    if (line?.length) {
      const pts = line.map((c) => intersectionToWorld(c.x, c.y));
      winFx.showLine(pts, { factor: 1 });
    }
  });

  session.start();

  window.addEventListener("beforeunload", () => {
    boardLayer.destroy();
    stage.destroy();
  });
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
