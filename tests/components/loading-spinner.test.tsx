import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

test("renders a decorative spinner with the requested size", () => {
  render(<LoadingSpinner size="sm" />);

  const spinner = screen.getByTestId("loading-spinner");
  expect(spinner).toHaveAttribute("aria-hidden", "true");
  expect(spinner).toHaveClass("loading-spinner", "loading-spinner-sm");
});

test("uses the medium size by default and accepts an extra class", () => {
  render(<LoadingSpinner className="text-white" />);

  expect(screen.getByTestId("loading-spinner")).toHaveClass(
    "loading-spinner-md",
    "text-white",
  );
});
