import { bindAiStrengthHud } from "@abstract/pixi-shared";
import { GameController } from "./game-controller";
import { TzaarScene } from "./tzaar-scene";

async function main() {
  const mount = document.getElementById("app");
  const statusEl = document.getElementById("status");
  const depthEl = document.getElementById("ai-depth");
  const decBtn = document.getElementById("ai-dec");
  const incBtn = document.getElementById("ai-inc");
  const passBtn = document.getElementById("pass-btn");
  if (!mount || !statusEl || !depthEl || !decBtn || !incBtn || !passBtn) {
    throw new Error("Missing DOM nodes");
  }

  const controller = new GameController();
  const scene = new TzaarScene(
    mount,
    controller,
    statusEl,
    passBtn as HTMLButtonElement,
  );
  await scene.init(mount);

  controller.onUpdate((ev) => {
    scene.handleUpdate(ev);
  });

  bindAiStrengthHud({
    depthEl,
    decBtn,
    incBtn,
    onDepthChange: (depth) => controller.setAiDepth(depth),
  });

  passBtn.addEventListener("click", () => {
    void controller.passSecond();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") void controller.passSecond();
  });

  await controller.start();
}

main().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to start: " + String(err);
});
