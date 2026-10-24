import { GameController } from "./game-controller";
import { TakScene } from "./tak-scene";

const AI_STRENGTH_MIN = 1;
const AI_STRENGTH_MAX = 4;
const DEFAULT_AI_STRENGTH = 2;

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
  controller.setAiStrength(aiDepth);

  const scene = new TakScene(mount, controller, statusEl);
  await scene.init(mount);

  controller.onUpdate((ev) => {
    scene.handleUpdate(ev);
  });

  decBtn.addEventListener("click", () => {
    aiDepth = Math.max(AI_STRENGTH_MIN, aiDepth - 1);
    depthEl.textContent = String(aiDepth);
    controller.setAiStrength(aiDepth);
  });
  incBtn.addEventListener("click", () => {
    aiDepth = Math.min(AI_STRENGTH_MAX, aiDepth + 1);
    depthEl.textContent = String(aiDepth);
    controller.setAiStrength(aiDepth);
  });

  controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
