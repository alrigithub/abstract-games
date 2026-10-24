import { bindAiStrengthHud, createPixiStage } from "@abstract/pixi-shared";
import { GameController } from "./game-controller";
import { TakScene } from "./tak-scene";

const TAK_AI_MIN = 1;
const TAK_AI_MAX = 4;
const TAK_AI_DEFAULT = 2;

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

  bindAiStrengthHud({
    depthEl,
    decBtn,
    incBtn,
    min: TAK_AI_MIN,
    max: TAK_AI_MAX,
    initial: TAK_AI_DEFAULT,
    onChange: (depth) => {
      controller.setAiStrength(depth);
    },
  });

  const stage = await createPixiStage(mount, { backgroundAlpha: 0 });
  const scene = new TakScene(stage, controller, statusEl);
  scene.init();

  controller.onUpdate((ev) => {
    scene.handleUpdate(ev);
  });

  window.addEventListener("beforeunload", () => {
    stage.destroy();
  });

  controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
