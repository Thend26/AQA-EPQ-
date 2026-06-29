import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { AoAnalysisReview } from "@/components/documents/ao-analysis-review";
import type { AoAnalysisResponse } from "@/lib/documents/ao-schema";

const analysis: AoAnalysisResponse = {
  ao1: {
    suggestedNote: "AO1 建议",
    evidenceQuotes: ["子问题列表"],
    confidence: "medium",
    caution: "谨慎说明",
  },
  ao2: {
    suggestedNote: "AO2 建议",
    evidenceQuotes: ["来源比较表"],
    confidence: "high",
    caution: "",
  },
  ao3: {
    suggestedNote: "AO3 建议",
    evidenceQuotes: ["初稿"],
    confidence: "medium",
    caution: "",
  },
  ao4: {
    suggestedNote: "AO4 建议",
    evidenceQuotes: [],
    confidence: "low",
    caution: "证据不足",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

test("edits and applies selected AO suggestions", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(<AoAnalysisReview analysis={analysis} existingNotes={{}} onApply={onApply} />);

  await user.clear(screen.getByLabelText("编辑 AO1 建议"));
  await user.type(screen.getByLabelText("编辑 AO1 建议"), "修改后的 AO1");
  await user.click(screen.getByRole("checkbox", { name: "采用 AO2" }));
  await user.click(screen.getByRole("button", { name: "应用选中 AO 备注" }));

  expect(onApply).toHaveBeenCalledWith({
    ao1Note: "修改后的 AO1",
    ao3Note: "AO3 建议",
    ao4Note: "AO4 建议",
  });
});

test("asks before overwriting existing AO notes", async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const onApply = vi.fn();
  render(
    <AoAnalysisReview
      analysis={analysis}
      existingNotes={{ ao1Note: "已有 AO1" }}
      onApply={onApply}
    />,
  );

  await user.click(screen.getByRole("button", { name: "应用选中 AO 备注" }));

  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("AO1"));
  expect(onApply).not.toHaveBeenCalled();
});
