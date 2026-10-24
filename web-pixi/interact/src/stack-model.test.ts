import { describe, expect, it } from "vitest";
import {
  applyMoveSuffix,
  countSelectedHold,
  takeTopSuffix,
} from "./stack-model.ts";

describe("stack-model", () => {
  it("takeTopSuffix preserves order", () => {
    expect(takeTopSuffix(["a", "b", "c", "d"], 2)).toEqual(["c", "d"]);
  });

  it("applyMoveSuffix moves suffix between cells", () => {
    const cells = [["a", "b", "c"], []];
    const next = applyMoveSuffix(cells, 0, 1, 2);
    expect(next[0]).toEqual(["a"]);
    expect(next[1]).toEqual(["b", "c"]);
  });

  it("countSelectedHold matches tak state.ts cadence", () => {
    expect(countSelectedHold(0, 5, 400)).toBe(1);
    expect(countSelectedHold(399, 5, 400)).toBe(1);
    expect(countSelectedHold(400, 5, 400)).toBe(2);
    expect(countSelectedHold(1600, 5, 400)).toBe(5);
  });
});
