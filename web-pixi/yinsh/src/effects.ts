import type { Coord } from "./coords";
import { screenPoint } from "./coords";
import { PixiWinLineEffects } from "@abstract/pixi-shared";
import { theme } from "./theme";

export class ScoreEffects extends PixiWinLineEffects {
  showScoredLine(coords: Coord[], spacing: number, factor: number) {
    const points = coords.map((c) => screenPoint(c, spacing));
    this.showLine(points, factor, { lingerMs: theme.scoreLingerMs });
  }

  update(dtMs: number, _spacing: number, _factor: number) {
    super.update(dtMs);
  }
}
