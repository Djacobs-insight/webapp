// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { BottomNav } from "../bottom-nav";

beforeEach(() => {
  mockPathname = "/";
});

describe("BottomNav", () => {
  it("renders all four nav items", () => {
    render(<BottomNav />);
    expect(screen.getByText("Feed")).toBeDefined();
    expect(screen.getByText("Leaderboard")).toBeDefined();
    expect(screen.getByText("Family")).toBeDefined();
    expect(screen.getByText("Profile")).toBeDefined();
  });

  it("renders as a nav element", () => {
    render(<BottomNav />);
    expect(screen.getByRole("navigation")).toBeDefined();
  });

  it("marks Feed as active when on /", () => {
    mockPathname = "/";
    render(<BottomNav />);
    const feedLink = screen.getByText("Feed").closest("a");
    expect(feedLink?.getAttribute("aria-current")).toBe("page");
  });

  it("marks Leaderboard as active when on /board", () => {
    mockPathname = "/board";
    render(<BottomNav />);
    const boardLink = screen.getByText("Leaderboard").closest("a");
    expect(boardLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark other items as active", () => {
    mockPathname = "/profile";
    render(<BottomNav />);
    const feedLink = screen.getByText("Feed").closest("a");
    expect(feedLink?.getAttribute("aria-current")).toBeNull();
    const profileLink = screen.getByText("Profile").closest("a");
    expect(profileLink?.getAttribute("aria-current")).toBe("page");
  });

  it("links point to correct hrefs", () => {
    render(<BottomNav />);
    expect(screen.getByText("Feed").closest("a")?.getAttribute("href")).toBe("/");
    expect(screen.getByText("Leaderboard").closest("a")?.getAttribute("href")).toBe("/board");
    expect(screen.getByText("Family").closest("a")?.getAttribute("href")).toBe("/family");
    expect(screen.getByText("Profile").closest("a")?.getAttribute("href")).toBe("/profile");
  });
});
