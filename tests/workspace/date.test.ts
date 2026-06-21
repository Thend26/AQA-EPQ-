import { expect, test } from "vitest";

import {
  dateInTimeZone,
  localDateString,
  resolveWorkspaceDate,
} from "@/lib/workspace/date";

test("uses the Shanghai business date across the UTC day boundary", () => {
  expect(
    dateInTimeZone(new Date("2026-06-20T16:30:00.000Z")),
  ).toBe("2026-06-21");
});

test.each([
  "2026-02-29",
  "2026-2-03",
  "2026-02-03T00:00:00Z",
  "not-a-date",
])("rejects invalid or non-strict workspace date %s", (value) => {
  expect(resolveWorkspaceDate(value, "2026-06-21")).toEqual({
    date: "2026-06-21",
    provided: false,
  });
});

test("accepts a real strict YYYY-MM-DD date", () => {
  expect(resolveWorkspaceDate("2026-02-28", "2026-06-21")).toEqual({
    date: "2026-02-28",
    provided: true,
  });
});

test("formats the browser local calendar date instead of UTC", () => {
  expect(localDateString(new Date("2026-07-18T17:30:00Z"))).toMatch(
    /^\d{4}-\d{2}-\d{2}$/,
  );
});
