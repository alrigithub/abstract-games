import {
  InteractEngine,
  applyMoveSuffix,
  persistThemeId,
  resolveInitialThemeId,
  themeById,
  type InteractTheme,
  type PieceInstance,
  type Selection,
  type ThemeId,
} from "@abstract/pixi-interact";

const SIZE = 5;

function seedBoard(): { cells: string[][]; catalog: Map<string, PieceInstance> } {
  const cells: string[][] = Array.from({ length: SIZE * SIZE }, () => []);
  const catalog = new Map<string, PieceInstance>();
  const center = 12;
  for (let i = 0; i < 4; i++) {
    const id = `b-${i}`;
    catalog.set(id, { id, side: "A", kind: { game: "tak", variant: "flat" } });
    cells[center]!.push(id);
  }
  for (let i = 0; i < 2; i++) {
    const id = `w-${i}`;
    catalog.set(id, { id, side: "B", kind: { game: "tak", variant: "flat" } });
    cells[center + 1]!.push(id);
  }
  return { cells, catalog };
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function applyThemeToDom(theme: InteractTheme): void {
  document.body.style.background = hex(theme.stageBg);
  document.body.style.color = hex(theme.hudInk);
  document.documentElement.style.setProperty("--btn-on", hex(theme.stageBg));
  const btn = document.getElementById("theme");
  if (btn) btn.textContent = theme.id === "dark" ? "Dark" : "Light";
}

function wireThemeToggle(engine: InteractEngine, initial: ThemeId): void {
  let current = initial;
  applyThemeToDom(themeById(current));

  const btn = document.getElementById("theme");
  btn?.addEventListener("click", () => {
    current = current === "dark" ? "light" : "dark";
    persistThemeId(current);
    const theme = themeById(current);
    engine.setTheme(theme);
    applyThemeToDom(theme);
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (ev) => {
    if (localStorage.getItem("abstract-pixi-interact-theme")) return;
    current = ev.matches ? "dark" : "light";
    const theme = themeById(current);
    engine.setTheme(theme);
    applyThemeToDom(theme);
  });
}

async function main() {
  const mount = document.getElementById("app");
  if (!mount) throw new Error("#app missing");

  const themeId = resolveInitialThemeId();
  const seed = seedBoard();
  let cells = seed.cells.map((c) => c.slice());

  const engine = new InteractEngine({
    mount,
    boardSize: SIZE,
    cellPitchPx: 58,
    theme: themeById(themeId),
    initialCells: seed.cells,
    pieceCatalog: seed.catalog,
    hooks: {
      getCells: () => cells,
      getTray: () => 6,
      canPick: (source) => {
        if (source.type === "tray") return true;
        return (cells[source.index]?.length ?? 0) > 0;
      },
      legalTargets: (sel: Selection) => {
        const all = Array.from({ length: SIZE * SIZE }, (_, i) => i);
        if (sel.source.type === "cell") {
          return all.filter((i) => i !== sel.source.index);
        }
        return all;
      },
      onCommit: (sel, target) => {
        if (sel.source.type === "cell") {
          cells = applyMoveSuffix(cells, sel.source.index, target, sel.count);
        } else {
          const stack = cells[target] ?? [];
          const newIds = Array.from({ length: sel.count }, (_, i) => `t-${Date.now()}-${i}`);
          cells = cells.map((c) => c.slice());
          cells[target] = [...stack, ...newIds];
        }
        return true;
      },
    },
  });

  wireThemeToggle(engine, themeId);

  document.getElementById("ai")?.addEventListener("click", () => {
    void engine.animateMove({ type: "tray", side: "B", slot: 0 }, 7, 1, true);
  });

  document.getElementById("gallery")?.addEventListener("click", () => {
    void import("./gallery.ts");
  });
}

main().catch(console.error);
