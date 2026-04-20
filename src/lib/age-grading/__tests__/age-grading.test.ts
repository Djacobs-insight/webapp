import { describe, it, expect } from "vitest";
import { calculateAgeGradedPercentage, calculateAgeOnDate } from "../index";

describe("calculateAgeOnDate", () => {
  it("calculates age correctly when birthday has passed", () => {
    const birthday = new Date("1990-01-15");
    const raceDate = new Date("2026-04-20");
    expect(calculateAgeOnDate(birthday, raceDate)).toBe(36);
  });

  it("calculates age correctly when birthday has not passed", () => {
    const birthday = new Date("1990-06-15");
    const raceDate = new Date("2026-04-20");
    expect(calculateAgeOnDate(birthday, raceDate)).toBe(35);
  });

  it("calculates age on birthday exactly", () => {
    const birthday = new Date("1990-04-20");
    const raceDate = new Date("2026-04-20");
    expect(calculateAgeOnDate(birthday, raceDate)).toBe(36);
  });
});

describe("calculateAgeGradedPercentage", () => {
  it("returns null for zero finish time", () => {
    expect(calculateAgeGradedPercentage(0, 30, "M")).toBeNull();
  });

  it("returns null for negative finish time", () => {
    expect(calculateAgeGradedPercentage(-100, 30, "M")).toBeNull();
  });

  it("returns null for age below 5", () => {
    expect(calculateAgeGradedPercentage(1200, 4, "M")).toBeNull();
  });

  it("returns null for age above 100", () => {
    expect(calculateAgeGradedPercentage(1200, 101, "M")).toBeNull();
  });

  it("returns a valid percentage for a typical male runner", () => {
    // 25:00 = 1500 seconds, age 30, male
    const result = calculateAgeGradedPercentage(1500, 30, "M");
    expect(result).not.toBeNull();
    expect(result!.percentage).toBeGreaterThan(0);
    expect(result!.percentage).toBeLessThan(100);
    expect(result!.gradedTimeSeconds).toBeGreaterThan(0);
  });

  it("returns a valid percentage for a typical female runner", () => {
    // 30:00 = 1800 seconds, age 40, female
    const result = calculateAgeGradedPercentage(1800, 40, "F");
    expect(result).not.toBeNull();
    expect(result!.percentage).toBeGreaterThan(0);
    expect(result!.percentage).toBeLessThan(100);
  });

  it("gives higher percentage for faster times at same age", () => {
    const fast = calculateAgeGradedPercentage(900, 30, "M")!;
    const slow = calculateAgeGradedPercentage(1800, 30, "M")!;
    expect(fast.percentage).toBeGreaterThan(slow.percentage);
  });

  it("rounds percentage to 2 decimal places", () => {
    const result = calculateAgeGradedPercentage(1500, 30, "M")!;
    const decimals = result.percentage.toString().split(".")[1];
    expect(!decimals || decimals.length <= 2).toBe(true);
  });
});
