import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";

import { loadGenerationContext } from "@/lib/repositories/generation-context";

type Result = { data: unknown; error: { message: string } | null };

function createDb(results: Result[]) {
  const calls: Array<{
    table: string;
    filters: Array<[string, unknown]>;
    orders: Array<[string, unknown]>;
    limit?: number;
  }> = [];

  const db = {
    from: vi.fn((table: string) => {
      const call = {
        table,
        filters: [] as Array<[string, unknown]>,
        orders: [] as Array<[string, unknown]>,
        limit: undefined as number | undefined,
      };
      calls.push(call);
      const result = results[calls.length - 1];
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          call.filters.push([column, value]);
          return builder;
        }),
        lte: vi.fn((column: string, value: unknown) => {
          call.filters.push([`${column}<=`, value]);
          return builder;
        }),
        lt: vi.fn((column: string, value: unknown) => {
          call.filters.push([`${column}<`, value]);
          return builder;
        }),
        in: vi.fn((column: string, values: unknown[]) => {
          call.filters.push([`${column} in`, values]);
          return builder;
        }),
        order: vi.fn((column: string, options: unknown) => {
          call.orders.push([column, options]);
          return builder;
        }),
        limit: vi.fn((value: number) => {
          call.limit = value;
          const inFilter = call.filters.find(([column]) =>
            column.endsWith(" in"),
          );
          if (!inFilter || !Array.isArray(result.data)) {
            return Promise.resolve(result);
          }
          const column = inFilter[0].slice(0, -" in".length);
          const values = inFilter[1] as unknown[];
          return Promise.resolve({
            ...result,
            data: result.data.filter(
              (row) =>
                typeof row === "object" &&
                row !== null &&
                values.includes((row as Record<string, unknown>)[column]),
            ),
          });
        }),
        maybeSingle: vi.fn(() => Promise.resolve(result)),
        then: (
          resolve: (value: Result) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    }),
  } as unknown as SupabaseClient;

  return { db, calls };
}

const targetRow = {
  id: "123e4567-e89b-42d3-a456-426614174001",
  student_id: "123e4567-e89b-42d3-a456-426614174000",
  record_date: "2026-07-18",
  camp_day: 3,
  achievements: "筛选4篇文献",
  evidence: "900字笔记",
  challenges: "来源冲突",
  next_plan: "做比较表",
  process_notes: "",
  behavior_tags: ["主动提问"],
  ao1_note: "",
  ao2_note: "记录出处",
  ao3_note: "",
  ao4_note: "识别冲突",
};

test("loads the target, student, latest five records, and final feedbacks with owner scope", async () => {
  const recentRows = Array.from({ length: 5 }, (_, index) => ({
    ...targetRow,
    id: `record-${index}`,
  }));
  const { db, calls } = createDb([
    { data: targetRow, error: null },
    {
      data: {
        id: targetRow.student_id,
        display_name: "林同学",
        grade: "10",
        project_title: "短视频与注意力",
        background_notes: "",
        current_focus: "来源比较",
      },
      error: null,
    },
    { data: recentRows, error: null },
    {
      data: recentRows.map(({ id }) => ({ id })),
      error: null,
    },
    {
      data: [
        {
          daily_record_id: recentRows[0].id,
          created_at: "2026-07-17T12:00:00Z",
          language_mode: "zh",
          content_zh: "昨日反馈",
          content_en: null,
        },
      ],
      error: null,
    },
  ]);

  const result = await loadGenerationContext(
    db,
    "owner-123",
    targetRow.id,
  );

  expect(result.error).toBeNull();
  expect(result.notFound).toBe(false);
  expect(result.data?.records).toHaveLength(5);
  expect(calls[0].filters).toEqual([
    ["id", targetRow.id],
    ["owner_id", "owner-123"],
  ]);
  expect(calls[1].filters).toContainEqual(["owner_id", "owner-123"]);
  expect(calls[2].filters).toEqual(
    expect.arrayContaining([
      ["owner_id", "owner-123"],
      ["student_id", targetRow.student_id],
      ["record_date<=", targetRow.record_date],
    ]),
  );
  expect(calls[2].limit).toBe(5);
  expect(calls[3].filters).toEqual(
    expect.arrayContaining([
      ["owner_id", "owner-123"],
      ["student_id", targetRow.student_id],
      ["record_date<", targetRow.record_date],
    ]),
  );
  expect(calls[3].orders).toEqual([
    ["record_date", { ascending: false }],
    ["id", { ascending: false }],
  ]);
  expect(calls[3].limit).toBe(10);
  expect(calls[4].filters).toEqual(
    expect.arrayContaining([
      ["owner_id", "owner-123"],
      ["student_id", targetRow.student_id],
      ["status", "final"],
      [
        "daily_record_id in",
        recentRows.map(({ id }) => id),
      ],
    ]),
  );
  expect(calls[4].orders).toEqual([
    ["created_at", { ascending: false }],
    ["id", { ascending: false }],
  ]);
  expect(calls[4].limit).toBe(3);
});

test("excludes feedback attached to the target record or a future record", async () => {
  const pastRecordId = "record-past";
  const futureRecordId = "record-future";
  const { db } = createDb([
    { data: targetRow, error: null },
    {
      data: {
        id: targetRow.student_id,
        display_name: "林同学",
        grade: "10",
        project_title: "短视频与注意力",
        background_notes: "",
        current_focus: "来源比较",
      },
      error: null,
    },
    { data: [targetRow], error: null },
    { data: [{ id: pastRecordId }], error: null },
    {
      data: [
        {
          daily_record_id: futureRecordId,
          created_at: "2026-07-20T12:00:00Z",
          language_mode: "zh",
          content_zh: "未来反馈",
          content_en: null,
        },
        {
          daily_record_id: targetRow.id,
          created_at: "2026-07-18T12:00:00Z",
          language_mode: "zh",
          content_zh: "目标自身反馈",
          content_en: null,
        },
        {
          daily_record_id: pastRecordId,
          created_at: "2026-07-17T12:00:00Z",
          language_mode: "zh",
          content_zh: "截至目标日期的反馈",
          content_en: null,
        },
      ],
      error: null,
    },
  ]);

  const result = await loadGenerationContext(
    db,
    "owner-123",
    targetRow.id,
  );

  expect(result.error).toBeNull();
  expect(result.data?.priorFeedbacks).toEqual([
    expect.objectContaining({ contentZh: "截至目标日期的反馈" }),
  ]);
});

test("stops with not found when the owner-scoped target does not exist", async () => {
  const { db, calls } = createDb([{ data: null, error: null }]);

  const result = await loadGenerationContext(
    db,
    "owner-123",
    targetRow.id,
  );

  expect(result).toMatchObject({
    data: null,
    error: null,
    notFound: true,
  });
  expect(calls).toHaveLength(1);
});

test("returns a repository error without leaking partial context", async () => {
  const { db } = createDb([
    { data: targetRow, error: null },
    { data: null, error: { message: "database details" } },
  ]);

  const result = await loadGenerationContext(
    db,
    "owner-123",
    targetRow.id,
  );

  expect(result.data).toBeNull();
  expect(result.error).toEqual({ message: "database details" });
});
