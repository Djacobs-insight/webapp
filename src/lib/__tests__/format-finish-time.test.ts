import { describe, it, expect } from "vitest";
import { formatFinishTime } from "../format-finish-time";

describe("formatFinishTime", () => {
  it("returns empty for empty input", () => {
    expect(formatFinishTime("")).toBe("");
  });

  it("keeps 1-2 digits unformatted", () => {
    expect(formatFinishTime("2")).toBe("2");
    expect(formatFinishTime("25")).toBe("25");
  });

  it("inserts colon at 3 digits", () => {
    expect(formatFinishTime("253")).toBe("2:53");
  });

  it("formats 4 digits as mm:ss", () => {
    expect(formatFinishTime("2530")).toBe("25:30");
  });

  it("formats 5 digits as mmm:ss", () => {
    expect(formatFinishTime("12345")).toBe("123:45");
  });

  it("strips non-digit characters (including pasted colons)", () => {
    expect(formatFinishTime("25:30")).toBe("25:30");
    expect(formatFinishTime("abc25def30")).toBe("25:30");
  });

  it("caps at 5 digits", () => {
    expect(formatFinishTime("1234567")).toBe("123:45");
  });

  it("re-formats correctly when a digit is removed", () => {
    // user backspaces "25:30" -> raw "25:3" -> 3 digits "253" -> "2:53"
    expect(formatFinishTime("25:3")).toBe("2:53");
  });
});
