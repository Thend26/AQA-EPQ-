import { render, screen } from "@testing-library/react";

import Home from "@/app/page";

test("shows the EPQ product name", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { name: "EPQ Camp Companion" }),
  ).toBeInTheDocument();
});
