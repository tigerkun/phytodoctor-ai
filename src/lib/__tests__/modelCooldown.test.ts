import { describe, it, expect } from "vitest";
import {
  MODEL_CHAIN,
  MODEL_COOLDOWN_MS,
  MODEL_MISSING_COOLDOWN_MS,
  cooldownFor,
  selectModels,
} from "../modelCooldown";

const NOW = 1_700_000_000_000;

describe("model cooldown", () => {
  it("returns the full chain when nothing has failed", () => {
    expect(selectModels(NOW, new Map())).toEqual([...MODEL_CHAIN]);
  });

  it("skips a model that just timed out, preserving order", () => {
    const cooldown = new Map([["gemini-3.8-flash", cooldownFor(false, NOW)]]);
    expect(selectModels(NOW, cooldown)).toEqual([
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
    ]);
  });

  it("skips a model that was capacity-shed without dropping the whole tier", () => {
    const cooldown = new Map([["gemini-3.8-flash", NOW + 1000]]);
    const models = selectModels(NOW, cooldown);
    expect(models).not.toContain("gemini-3.8-flash");
    expect(models.length).toBe(MODEL_CHAIN.length - 1);
  });

  it("returns a cooled-down model once its window expires", () => {
    const cooldown = new Map([["gemini-3.8-flash", NOW + 1]]);
    expect(selectModels(NOW + 1, cooldown)).toContain("gemini-3.8-flash");
  });

  it("parks a retired model far longer than a transient failure", () => {
    expect(cooldownFor(true, NOW) - NOW).toBe(MODEL_MISSING_COOLDOWN_MS);
    expect(cooldownFor(false, NOW) - NOW).toBe(MODEL_COOLDOWN_MS);
    expect(MODEL_MISSING_COOLDOWN_MS).toBeGreaterThan(MODEL_COOLDOWN_MS);
  });

  it("degrades to the full chain when every model is cooling down", () => {
    // The important safety property: a stale cooldown must never become an outage.
    const cooldown = new Map(MODEL_CHAIN.map(m => [m, NOW + 60_000]));
    expect(selectModels(NOW, cooldown)).toEqual([...MODEL_CHAIN]);
  });

  it("puts a configured model first when it is healthy", () => {
    expect(selectModels(NOW, new Map(), "gemini-custom")[0]).toBe("gemini-custom");
  });

  it("honours a cooldown against the configured model too", () => {
    const cooldown = new Map([["gemini-custom", NOW + 60_000]]);
    const models = selectModels(NOW, cooldown, "gemini-custom");
    expect(models[0]).toBe("gemini-3.8-flash");
    expect(models).not.toContain("gemini-custom");
  });
});