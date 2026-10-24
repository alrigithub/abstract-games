import {
  AI_STRENGTH_MAX,
  AI_STRENGTH_MIN,
  DEFAULT_AI_STRENGTH,
} from "./theme";
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

  let aiDepth = DEFAULT_AI_STRENGTH;
  depthEl.textContent = String(aiDepth);

  const controller = new GameController();
  controller.setAiDepth(aiDepth);

  const scene = new YinshScene(mount, controller, statusEl);
  await scene.init(mount);

  controller.onUpdate(({ state, status, visual }) => {
    scene.handleState(state, status, visual);
  });

  decBtn.addEventListener("click", () => {
    aiDepth = Math.max(AI_STRENGTH_MIN, aiDepth - 1);
    depthEl.textContent = String(aiDepth);
    controller.setAiDepth(aiDepth);
  });
  incBtn.addEventListener("click", () => {
    aiDepth = Math.min(AI_STRENGTH_MAX, aiDepth + 1);
    depthEl.textContent = String(aiDepth);
    controller.setAiDepth(aiDepth);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "PageDown") decBtn.click();
    if (e.key === "PageUp") incBtn.click();
  });

  await controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
