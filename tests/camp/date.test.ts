import { expect, test } from "vitest";

import {
  campDayForDate,
  dateForCampDay,
  defaultWorkspaceDate,
} from "@/lib/camp/date";

test("treats the camp start date as day 1", () => {
  expect(campDayForDate("2026-07-16", "2026-07-16")).toBe(1);
});

test("calculates camp days across month boundaries", () => {
  expect(campDayForDate("2026-07-16", "2026-08-01")).toBe(17);
});

test("calculates camp days across year boundaries", () => {
  expect(campDayForDate("2026-12-31", "2027-01-01")).toBe(2);
});

test("returns null before camp starts", () => {
  expect(campDayForDate("2026-07-16", "2026-07-15")).toBeNull();
});

test("returns the calendar date for a camp day", () => {
  expect(dateForCampDay("2026-07-16", 17)).toBe("2026-08-01");
  expect(dateForCampDay("2026-12-31", 2)).toBe("2027-01-01");
});

test("uses camp start as the default before camp and today once camp begins", () => {
  expect(defaultWorkspaceDate("2026-07-10", "2026-07-16")).toBe(
    "2026-07-16",
  );
  expect(defaultWorkspaceDate("2026-07-18", "2026-07-16")).toBe(
    "2026-07-18",
  );
});

test.each([
  ["2026-7-16", "2026-07-16"],
  ["2026-02-29", "2026-02-28"],
  ["2026-07-16T00:00:00Z", "2026-07-16"],
])("rejects non-strict or unreal calendar dates", (date, startDate) => {
  expect(campDayForDate(startDate, date)).toBeNull();
});
