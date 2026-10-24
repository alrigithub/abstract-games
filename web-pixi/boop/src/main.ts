import { createPixiStage, fitCamera } from "@abstract/pixi-shared";
import { createBoopBoardLayer } from "./board/boop-board";
import { CELL } from "./board/coords";
import { BED_SIZE } from "./engine/types";
import { BoopGameController } from "./game-controller";
import type { Application } from "pixi.js";

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
  let boardLayer: ReturnType<typeof createBoopBoardLayer> | null = null;
  let app: Application | null = null;

  function syncBoard() {
    if (!boardLayer || !app) return;
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
      app,
    );
  }

  const { api, destroy } = await createPixiStage(mount, {
    onReady: (stageApi) => {
      app = stageApi.app;
      const span = CELL * BED_SIZE;
      stageApi.setCamera(
        fitCamera(
          { width: span, height: span },
          {
            width: stageApi.app.screen.width,
            height: stageApi.app.screen.height,
          },
          0.9,
        ),
      );
      boardLayer?.destroy();
      boardLayer = createBoopBoardLayer(stageApi.world, {
        onPlace: (row, col) => void controller.placeAt(row, col),
      });
      syncBoard();
    },
  });
  app = api.app;

  function setToggleActive(kind: "kitten" | "cat") {
    kittenBtn.classList.toggle("active", kind === "kitten");
    catBtn.classList.toggle("active", kind === "cat");
  }

  controller.onUpdate(({ state, status, aiThinking }) => {
    statusEl.textContent = status;
    setToggleActive(controller.getSelectedKind());
    void aiThinking;
    void state;
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
    boardLayer?.destroy();
    destroy();
  });

  await controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
