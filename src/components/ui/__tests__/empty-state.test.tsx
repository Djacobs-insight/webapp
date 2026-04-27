// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No results yet" />);
    expect(screen.getByText("No results yet")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Add something to get started" />);
    expect(screen.getByText("Add something to get started")).toBeDefined();
  });

  it("does not render description when omitted", () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">🏃</span>} />);
    expect(screen.getByTestId("icon")).toBeDefined();
  });

  it("renders action when provided", () => {
    render(<EmptyState title="Empty" action={<button>Add result</button>} />);
    expect(screen.getByRole("button", { name: "Add result" })).toBeDefined();
  });
});
