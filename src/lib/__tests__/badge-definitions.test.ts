import { describe, it, expect } from "vitest";
import {
  BADGE_DEFINITIONS,
  getBadgeDefinition,
  getProgressHint,
} from "../badge-definitions";

describe("BADGE_DEFINITIONS", () => {
  it("has 15 badges", () => {
    expect(BADGE_DEFINITIONS).toHaveLength(15);
  });

  it("has unique keys", () => {
    const keys = BADGE_DEFINITIONS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers all categories", () => {
    const categories = new Set(BADGE_DEFINITIONS.map((b) => b.category));
    expect(categories).toContain("runs");
    expect(categories).toContain("speed");
    expect(categories).toContain("age_grade");
    expect(categories).toContain("streak");
    expect(categories).toContain("social");
  });
});

describe("getBadgeDefinition", () => {
  it("returns badge by key", () => {
    const badge = getBadgeDefinition("first_run");
    expect(badge).toBeDefined();
    expect(badge!.name).toBe("First Steps");
  });

  it("returns undefined for unknown key", () => {
    expect(getBadgeDefinition("nonexistent")).toBeUndefined();
  });
});

describe("getProgressHint", () => {
  const baseStats = {
    runCount: 5,
    fastestTime: 32 * 60 as number | null,
    bestAgeGrade: 55 as number | null,
    weekStreak: 2,
    photoCount: 2,
    commentCount: 3,
  };

  it("returns remaining runs for run_count badge", () => {
    const badge = getBadgeDefinition("runs_10")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toBe("5 more runs to go");
  });

  it("returns null when badge is already met", () => {
    const badge = getBadgeDefinition("first_run")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toBeNull();
  });

  it("returns time to shave for speed badge", () => {
    const badge = getBadgeDefinition("sub_30")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toContain("to shave off");
  });

  it("returns age grade gap for ag badge", () => {
    const badge = getBadgeDefinition("ag_60")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toContain("5.0%");
  });

  it("returns weeks remaining for streak badge", () => {
    const badge = getBadgeDefinition("streak_4")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toBe("2 more weeks in a row");
  });

  it("returns photos remaining for photo badge", () => {
    const badge = getBadgeDefinition("shutterbug")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toBe("3 more photos to upload");
  });

  it("returns comments remaining for comment badge", () => {
    const badge = getBadgeDefinition("cheerleader")!;
    const hint = getProgressHint(badge, baseStats);
    expect(hint).toBe("7 more comments to leave");
  });

  it("handles null fastestTime", () => {
    const badge = getBadgeDefinition("sub_30")!;
    const hint = getProgressHint(badge, { ...baseStats, fastestTime: null });
    expect(hint).toBe("Record a result to start");
  });

  it("handles null bestAgeGrade", () => {
    const badge = getBadgeDefinition("ag_60")!;
    const hint = getProgressHint(badge, { ...baseStats, bestAgeGrade: null });
    expect(hint).toBe("Need age-grading data");
  });
});
