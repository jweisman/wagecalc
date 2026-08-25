import { describe, expect, it } from "vitest";
import { calculateWage, durationMinutes, snapDateToInterval, timeOptions } from "./calculator";

describe("calculator", () => {
  it("calculates same-day and overnight durations", () => {
    expect(durationMinutes("09:00", "13:30")).toBe(270);
    expect(durationMinutes("22:00", "04:00")).toBe(360);
  });

  it("rejects durations longer than twelve hours", () => {
    expect(durationMinutes("22:00", "21:00")).toBeNull();
    expect(durationMinutes("08:00", "20:15")).toBeNull();
  });

  it("snaps now to the nearest interval", () => {
    expect(snapDateToInterval(new Date(2026, 0, 1, 10, 7), 15)).toBe("10:00");
    expect(snapDateToInterval(new Date(2026, 0, 1, 10, 8), 15)).toBe("10:15");
  });

  it("builds constrained time options and calculates wages", () => {
    expect(timeOptions(30)).toHaveLength(48);
    expect(calculateWage(100, 90)).toBe(150);
  });
});
