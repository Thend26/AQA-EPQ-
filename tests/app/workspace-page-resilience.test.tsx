import { describe, expect, test, vi } from "vitest";

const {
  getUser,
  listStudents,
  getUserSettings,
  getDailyRecord,
  loadWorkspaceFeedbacks,
  workspaceShell,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  listStudents: vi.fn(),
  getUserSettings: vi.fn(),
  getDailyRecord: vi.fn(),
  loadWorkspaceFeedbacks: vi.fn(),
  workspaceShell: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/repositories/students", () => ({ listStudents }));
vi.mock("@/lib/repositories/settings", () => ({ getUserSettings }));
vi.mock("@/lib/repositories/daily-records", () => ({ getDailyRecord }));
vi.mock("@/lib/repositories/workspace-feedbacks", () => ({ loadWorkspaceFeedbacks }));
vi.mock("@/components/workspace/workspace-shell", () => ({
  WorkspaceShell: workspaceShell,
}));

import WorkspacePage from "@/app/(protected)/workspace/page";

describe("WorkspacePage resilience", () => {
  test("renders an empty workspace instead of throwing when optional data loads fail", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "owner-1", email: "tutor@example.com" } },
      error: null,
    });
    listStudents.mockResolvedValue({
      data: null,
      error: { message: "students unavailable" },
    });
    getUserSettings.mockResolvedValue({
      data: null,
      error: { message: "settings unavailable" },
    });

    const page = await WorkspacePage({ searchParams: Promise.resolve({}) });

    expect(page.props).toEqual(
      expect.objectContaining({
        students: [],
        selectedStudent: null,
        dailyRecord: null,
        feedback: null,
        feedbackHistory: [],
      }),
    );
  });
});
