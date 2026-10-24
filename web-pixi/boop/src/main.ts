import {
  AnimatedBackground,
  createPixiStage,
  fitCamera,
} from "@abstract/pixi-shared";
import { createBoopBoardLayer } from "./board/boop-board";
import { CELL } from "./board/coords";
import { BED_SIZE } from "./engine/types";
import { BoopGameController } from "./game-controller";

async function main() {
  const mount = document.getElementById("app");
  const statusEl = document.getElementById("status");
  const kittenBtn = document.getElementById("piece-kitten");
  const catBtn = document.getElementById("piece-cat");
  const newBtn = document.getElementById("new-game");
  if (!mount || !statusEl || !kittenBtn || !catBtn || !newBtn) {
    throw new Error("Missing DOM nodes");
  }

  const controller = new BoopGameController();
  const stage = await createPixiStage(mount, { backgroundAlpha: 0 });
  const bg = new AnimatedBackground();
  stage.app.stage.addChildAt(bg, 0);

  const span = CELL * BED_SIZE;
  stage.setCamera(
    fitCamera(
      { width: span, height: span },
      { width: stage.app.screen.width, height: stage.app.screen.height },
      0.9,
    ),
  );

  const boardLayer = createBoopBoardLayer(stage.world, {
    onPlace: (row, col) => void controller.placeAt(row, col),
  });

  stage.app.ticker.add((t) => {
    bg.update(t.deltaMS, stage.app.screen.width, stage.app.screen.height);
  });

  function setToggleActive(kind: "kitten" | "cat") {
    kittenBtn.classList.toggle("active", kind === "kitten");
    catBtn.classList.toggle("active", kind === "cat");
  }

  function syncBoard() {
    const state = controller.getState();
    const interactive =
      state.status.kind === "playing" &&
      state.status.toMove === "black" &&
      !controller.isBusy();
    boardLayer.update(
      {
        state,
        interactive,
        selectedKind: controller.getSelectedKind(),
      },
      stage.app,
    );
  }

  controller.onUpdate(({ status, aiThinking }) => {
    statusEl.textContent = status;
    setToggleActive(controller.getSelectedKind());
    void aiThinking;
    syncBoard();
  });

  kittenBtn.addEventListener("click", () => {
    controller.setSelectedKind("kitten");
    setToggleActive("kitten");
    syncBoard();
  });
  catBtn.addEventListener("click", () => {
    controller.setSelectedKind("cat");
    setToggleActive("cat");
    syncBoard();
  });
  newBtn.addEventListener("click", () => controller.newGame());

  window.addEventListener("keydown", (e) => {
    if (e.key === "c" || e.key === "C") {
      const next =
        controller.getSelectedKind() === "kitten" ? "cat" : "kitten";
      controller.setSelectedKind(next);
      setToggleActive(next);
      syncBoard();
    }
  });

  window.addEventListener("beforeunload", () => {
    boardLayer.destroy();
    stage.destroy();
  });

  await controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
