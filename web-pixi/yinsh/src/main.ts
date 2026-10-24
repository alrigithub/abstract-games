import { bindAiStrengthHud } from "@abstract/pixi-shared";
import { GameController } from "./game-controller";
import { YinshScene } from "./yinsh-scene";

async function main() {
  const mount = document.getElementById("app");
  const statusEl = document.getElementById("status");
  const depthEl = document.getElementById("ai-depth");
  const decBtn = document.getElementById("ai-dec");
  const incBtn = document.getElementById("ai-inc");
  if (!mount || !statusEl || !depthEl || !decBtn || !incBtn) {
    throw new Error("Missing DOM nodes");
  }

  const controller = new GameController();

  const scene = new YinshScene(mount, controller, statusEl);
  await scene.init(mount);

  controller.onUpdate(({ state, status, visual }) => {
    scene.handleState(state, status, visual);
  });

  bindAiStrengthHud({
    depthEl,
    decBtn,
    incBtn,
    onDepthChange: (depth) => controller.setAiDepth(depth),
  });

  await controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
