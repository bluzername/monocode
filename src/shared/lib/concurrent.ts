/**
 * Wait for `promise` to settle, but give up after `ms` and resolve anyway so
 * a caller is never stuck on something that is slow or never settles (e.g. a
 * boot-time IPC call gating the first render). If `promise` does go on to
 * settle later, anything already chained onto it (`.then`/`.catch`) still
 * runs as normal - this only bounds how long *this* wait can take.
 */
export function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    promise.then(finish, finish);
    setTimeout(finish, ms);
  });
}

/** Run async work with a small fixed worker pool. */
export async function forEachConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(concurrency) || 1),
  );
  let nextIndex = 0;

  const worker = async () => {
    while (shouldContinue()) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await task(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
}
