// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Button } from "../button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeDefined();
  });

  it("applies primary variant by default", () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-coral/);
  });

  it("applies secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/border-teal/);
  });

  it("applies destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/border-red-600/);
  });

  it("applies ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/text-teal/);
  });

  it("applies icon variant", () => {
    render(<Button variant="icon">🏃</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/rounded-full/);
  });

  it("passes through HTML button attributes", () => {
    render(<Button disabled data-testid="test-btn">Disabled</Button>);
    const btn = screen.getByTestId("test-btn");
    expect(btn).toHaveProperty("disabled", true);
  });

  it("merges custom className", () => {
    render(<Button className="mt-4">Styled</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/mt-4/);
  });
});
