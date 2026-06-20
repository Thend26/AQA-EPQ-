import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getUser,
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  listStudents: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/repositories/students", () => ({
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
}));

import { GET, POST } from "@/app/api/students/route";
import {
  DELETE,
  PATCH,
} from "@/app/api/students/[id]/route";

const validInput = {
  displayName: "林同学",
  grade: "10",
  projectTitle: "Attention and short video",
  campStartDate: "2026-07-16",
  backgroundNotes: "",
  currentFocus: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: "authenticated-owner" } },
    error: null,
  });
});

describe("student collection API", () => {
  test("returns 401 without an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    expect((await GET()).status).toBe(401);
  });

  test("returns 503 with a safe message when authentication lookup fails", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "sensitive auth provider details" },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Authentication service unavailable",
    });
    expect(listStudents).not.toHaveBeenCalled();
  });

  test("lists students for the authenticated owner", async () => {
    listStudents.mockResolvedValue({ data: [], error: null });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listStudents).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
    );
  });

  test("rejects invalid JSON and client-supplied owner ids", async () => {
    const invalidJson = await POST(
      new Request("https://app.example/api/students", {
        method: "POST",
        body: "{",
      }),
    );
    const suppliedOwner = await POST(
      new Request("https://app.example/api/students", {
        method: "POST",
        body: JSON.stringify({ ...validInput, ownerId: "attacker" }),
      }),
    );

    expect(invalidJson.status).toBe(400);
    expect(suppliedOwner.status).toBe(400);
    expect(createStudent).not.toHaveBeenCalled();
  });

  test("creates a student with the authenticated owner", async () => {
    createStudent.mockResolvedValue({
      data: { id: "student-123" },
      error: null,
    });

    const response = await POST(
      new Request("https://app.example/api/students", {
        method: "POST",
        body: JSON.stringify(validInput),
      }),
    );

    expect(response.status).toBe(201);
    expect(createStudent).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
      validInput,
    );
  });

  test("returns 500 when listing fails", async () => {
    listStudents.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    expect((await GET()).status).toBe(500);
  });
});

describe("individual student API", () => {
  const studentId = "123e4567-e89b-42d3-a456-426614174000";
  const context = { params: Promise.resolve({ id: studentId }) };

  test("returns 404 when an owner-scoped update finds no student", async () => {
    updateStudent.mockResolvedValue({ data: null, error: null });

    const response = await PATCH(
      new Request("https://app.example/api/students/student-123", {
        method: "PATCH",
        body: JSON.stringify(validInput),
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(updateStudent).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
      studentId,
      validInput,
    );
  });

  test("accepts a partial update", async () => {
    updateStudent.mockResolvedValue({
      data: { id: studentId, currentFocus: "Refine sources" },
      error: null,
    });

    const response = await PATCH(
      new Request(`https://app.example/api/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentFocus: "Refine sources" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateStudent).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
      studentId,
      { currentFocus: "Refine sources" },
    );
  });

  test("rejects an empty partial update", async () => {
    const response = await PATCH(
      new Request(`https://app.example/api/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(updateStudent).not.toHaveBeenCalled();
  });

  test("returns 500 when updating fails", async () => {
    updateStudent.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    const response = await PATCH(
      new Request(`https://app.example/api/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ currentFocus: "Refine sources" }),
      }),
      context,
    );

    expect(response.status).toBe(500);
  });

  test("returns 404 when an owner-scoped delete finds no student", async () => {
    deleteStudent.mockResolvedValue({ data: null, error: null });

    const response = await DELETE(
      new Request("https://app.example/api/students/student-123", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(deleteStudent).toHaveBeenCalledWith(
      expect.anything(),
      "authenticated-owner",
      studentId,
    );
  });

  test("returns 401 before updating when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await PATCH(
      new Request("https://app.example/api/students/student-123", {
        method: "PATCH",
        body: JSON.stringify(validInput),
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(updateStudent).not.toHaveBeenCalled();
  });

  test("returns 401 before deleting when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE(
      new Request(`https://app.example/api/students/${studentId}`, {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(deleteStudent).not.toHaveBeenCalled();
  });

  test("returns 503 with a safe message when item authentication lookup fails", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "sensitive auth provider details" },
    });

    const response = await DELETE(
      new Request(`https://app.example/api/students/${studentId}`, {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Authentication service unavailable",
    });
    expect(deleteStudent).not.toHaveBeenCalled();
  });

  test.each([
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ])("returns 400 for an invalid UUID on %s", async (method, handler) => {
    const invalidContext = { params: Promise.resolve({ id: "not-a-uuid" }) };
    const request = new Request(
      "https://app.example/api/students/not-a-uuid",
      {
        method,
        ...(method === "PATCH"
          ? { body: JSON.stringify({ currentFocus: "Refine sources" }) }
          : {}),
      },
    );

    const response = await handler(request, invalidContext);

    expect(response.status).toBe(400);
    expect(updateStudent).not.toHaveBeenCalled();
    expect(deleteStudent).not.toHaveBeenCalled();
  });

  test("returns 500 when deletion fails", async () => {
    deleteStudent.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    const response = await DELETE(
      new Request("https://app.example/api/students/student-123", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(500);
  });
});
