import { beforeEach, describe, expect, test, vi } from "vitest";

const { getUser, getDailyRecord, upsertDailyRecord } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getDailyRecord: vi.fn(),
  upsertDailyRecord: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/repositories/daily-records", () => ({
  getDailyRecord,
  upsertDailyRecord,
}));

import { GET, PUT } from "@/app/api/daily-records/route";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const validInput = {
  studentId,
  recordDate: "2026-07-18",
  campDay: 3,
  achievements: "筛选了四篇文献",
  evidence: "",
  challenges: "",
  nextPlan: "比较研究方法",
  processNotes: "",
  behaviorTags: [],
  ao1Note: "",
  ao2Note: "",
  ao3Note: "",
  ao4Note: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: "authenticated-owner" } },
    error: null,
  });
});

describe("daily record API", () => {
  test("requires authentication for reads and writes", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const read = await GET(
      new Request(
        `https://app.example/api/daily-records?studentId=${studentId}&date=2026-07-18`,
      ),
    );
    const write = await PUT(
      new Request("https://app.example/api/daily-records", {
        method: "PUT",
        body: JSON.stringify(validInput),
      }),
    );

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
  });

  test("returns 503 when shared authentication lookup fails", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "provider details" },
    });

    const response = await GET(
      new Request(
        `https://app.example/api/daily-records?studentId=${studentId}&date=2026-07-18`,
      ),
    );

    expect(response.status).toBe(503);
    expect(getDailyRecord).not.toHaveBeenCalled();
  });

  test("reads by authenticated owner, student, and date", async () => {
    getDailyRecord.mockResolvedValue({
      data: null,
      error: null,
      notFound: false,
    });

    const response = await GET(
      new Request(
        `https://app.example/api/daily-records?studentId=${studentId}&date=2026-07-18`,
      ),
    );

    expect(response.status).toBe(200);
    expect(getDailyRecord).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
      studentId,
      "2026-07-18",
    );
  });

  test("returns 404 when reading a student not owned by the user", async () => {
    getDailyRecord.mockResolvedValue({
      data: null,
      error: null,
      notFound: true,
    });

    const response = await GET(
      new Request(
        `https://app.example/api/daily-records?studentId=${studentId}&date=2026-07-18`,
      ),
    );

    expect(response.status).toBe(404);
  });

  test("rejects invalid queries, JSON, owner ids, and client record ids", async () => {
    const invalidQuery = await GET(
      new Request(
        "https://app.example/api/daily-records?studentId=bad&date=2026-07-18",
      ),
    );
    const invalidJson = await PUT(
      new Request("https://app.example/api/daily-records", {
        method: "PUT",
        body: "{",
      }),
    );
    const spoofed = await PUT(
      new Request("https://app.example/api/daily-records", {
        method: "PUT",
        body: JSON.stringify({
          ...validInput,
          id: "123e4567-e89b-42d3-a456-426614174999",
          ownerId: "attacker",
        }),
      }),
    );

    expect(invalidQuery.status).toBe(400);
    expect(invalidJson.status).toBe(400);
    expect(spoofed.status).toBe(400);
    expect(upsertDailyRecord).not.toHaveBeenCalled();
  });

  test("returns 404 when the student is not owned by the user", async () => {
    upsertDailyRecord.mockResolvedValue({
      data: null,
      error: null,
      notFound: true,
    });

    const response = await PUT(
      new Request("https://app.example/api/daily-records", {
        method: "PUT",
        body: JSON.stringify(validInput),
      }),
    );

    expect(response.status).toBe(404);
  });

  test("upserts with the authenticated owner", async () => {
    upsertDailyRecord.mockResolvedValue({
      data: validInput,
      error: null,
      notFound: false,
    });

    const response = await PUT(
      new Request("https://app.example/api/daily-records", {
        method: "PUT",
        body: JSON.stringify(validInput),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertDailyRecord).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
      validInput,
    );
  });

  test.each([
    ["read", () => GET(new Request(
      `https://app.example/api/daily-records?studentId=${studentId}&date=2026-07-18`,
    )), getDailyRecord],
    ["write", () => PUT(new Request("https://app.example/api/daily-records", {
      method: "PUT",
      body: JSON.stringify(validInput),
    })), upsertDailyRecord],
  ])("returns 500 when a %s repository call fails", async (_name, call, repository) => {
    repository.mockResolvedValue({
      data: null,
      error: { message: "database details" },
    });

    expect((await call()).status).toBe(500);
  });
});
