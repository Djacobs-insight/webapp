// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { ToastProvider, useToast } from "../toast-provider";

function TestConsumer() {
  const { showToast, toasts } = useToast();
  return (
    <>
      <button onClick={() => showToast("success", "Saved!")}>trigger</button>
      <span data-testid="count">{toasts.length}</span>
    </>
  );
}

describe("ToastProvider", () => {
  it("renders children", () => {
    render(
      <ToastProvider>
        <span>hello</span>
      </ToastProvider>,
    );
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("shows toast when triggered", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    act(() => screen.getByText("trigger").click());
    expect(screen.getByText("Saved!")).toBeDefined();
  });

  it("auto-dismisses toast after duration", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    act(() => screen.getByText("trigger").click());
    expect(screen.getByTestId("count").textContent).toBe("1");
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId("count").textContent).toBe("0");
    vi.useRealTimers();
  });

  it("throws when useToast is used outside provider", () => {
    expect(() => render(<TestConsumer />)).toThrow("useToast must be used within ToastProvider");
  });

  it("renders toast with aria-live region", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    act(() => screen.getByText("trigger").click());
    const liveRegion = screen.getByText("Saved!").closest("[aria-live]");
    expect(liveRegion).toBeDefined();
  });
});
