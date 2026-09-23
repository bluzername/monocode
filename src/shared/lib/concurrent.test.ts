import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forEachConcurrent, settleWithin } from "./concurrent";

describe("settleWithin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves as soon as the promise settles, without waiting for the timeout", async () => {
    let resolveInner: () => void = () => {};
    const inner = new Promise<void>((resolve) => {
      resolveInner = resolve;
    });

    let settled = false;
    void settleWithin(inner, 1000).then(() => {
      settled = true;
    });

    resolveInner();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it("gives up after the timeout when the promise never settles", async () => {
    const hung = new Promise<void>(() => {});

    let settled = false;
    void settleWithin(hung, 1000).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it("resolves (does not reject) when the promise rejects", async () => {
    const failing = Promise.reject(new Error("boom")).catch(() => {
      throw new Error("boom");
    });
    // Swallow the unhandled-rejection warning for this deliberately-failing
    // fixture; settleWithin's own handling is what's under test.
    failing.catch(() => {});

    await expect(settleWithin(failing, 1000)).resolves.toBeUndefined();
  });
});

describe("forEachConcurrent", () => {
  it("bounds in-flight work and visits every item", async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];

    await forEachConcurrent([0, 1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      seen.push(item);
      active -= 1;
    });

    expect(peak).toBe(2);
    expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("stops assigning new work after cancellation", async () => {
    let running = true;
    const seen: number[] = [];

    await forEachConcurrent(
      [0, 1, 2, 3],
      1,
      async (item) => {
        seen.push(item);
        running = false;
      },
      () => running,
    );

    expect(seen).toEqual([0]);
  });
});
