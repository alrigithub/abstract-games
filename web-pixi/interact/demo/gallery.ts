import { Application, Container, Graphics, Text } from "pixi.js";
import {
  LIGHT_SOFT_THEME,
  drawPiece,
  resolveInitialThemeId,
  themeById,
  type DemoPieceKind,
} from "@abstract/pixi-interact";

const specs: { label: string; kind: DemoPieceKind }[] = [
  { label: "Tak flat", kind: { game: "tak", variant: "flat" } },
  { label: "Tak wall", kind: { game: "tak", variant: "wall" } },
  { label: "Tak cap", kind: { game: "tak", variant: "capstone" } },
  { label: "Gomoku", kind: { game: "gomoku" } },
  { label: "Boop cat", kind: { game: "boop" } },
  { label: "Boop kitten", kind: { game: "boop", kitten: true } },
];

async function run() {
  const theme = themeById(resolveInitialThemeId());
  const mount = document.getElementById("app") ?? document.body;
  mount.innerHTML = "";
  const app = new Application();
  await app.init({ background: theme.stageBg, resizeTo: mount, width: 900, height: 400 });
  mount.appendChild(app.canvas);

  const pitch = 72;
  specs.forEach((spec, i) => {
    const col = new Container();
    col.x = 40 + (i % 3) * 280;
    col.y = 40 + Math.floor(i / 3) * 160;
    const gA = new Graphics();
    const gB = new Graphics();
    drawPiece(gA, spec.kind, "B", pitch, theme);
    drawPiece(gB, spec.kind, "A", pitch, theme);
    gB.x = pitch * 1.2;
    col.addChild(gA, gB);
    const label = new Text({
      text: spec.label,
      style: { fill: theme.hudInk, fontSize: 13 },
    });
    label.y = pitch * 0.55;
    col.addChild(label);
    app.stage.addChild(col);
  });
}

run().catch(console.error);
