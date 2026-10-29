/**
 * One interruptible, best-effort background task sharing the foreground worker. Foreground work
 * no longer preempts it by itself: the worker cancels it only while the case slots are contended.
 */
export class PrecompileScheduler {
  private closed = false;
  private active?: {
    id: string;
    key?: string;
    adopted?: boolean;
    controller: AbortController;
    settled: Promise<void>;
  };
  get activeId() {
    return this.active?.id;
  }
  /** A foreground submission is waiting on this task's result. */
  isAdopted(id: string) {
    return this.active?.id === id && Boolean(this.active.adopted);
  }
  get canStart() {
    return !this.closed && !this.active;
  }
  start(
    id: string,
    task: (signal: AbortSignal) => Promise<unknown>,
    key?: string,
  ): boolean {
    if (!this.canStart) return false;
    const controller = new AbortController();
    // Defer user task until the active record is installed synchronously.
    const record = { id, key, controller, settled: Promise.resolve() };
    this.active = record;
    record.settled = Promise.resolve()
      .then(async () => {
        controller.signal.throwIfAborted();
        await task(controller.signal);
      })
      .catch(() => {
        // Speculation is optional. Formal compilation owns user-facing errors.
      })
      .finally(() => {
        if (this.active === record) this.active = undefined;
      });
    return true;
  }
  /** An adopted task is a submission's own compile: only close() stops it. */
  async cancelBackground(id?: string, force = false) {
    const active = this.active;
    if (!active || (id !== undefined && active.id !== id)) return;
    if (active.adopted && !force) return;
    active.controller.abort();
    await active.settled;
  }
  /** `key` adopts a background compile of the same program and waits for it; any other runs on. */
  async enterForeground(key?: string): Promise<void> {
    const active = this.active;
    if (active && key !== undefined && active.key === key) {
      active.adopted = true;
      await active.settled;
    }
  }
  async close() {
    this.closed = true;
    await this.cancelBackground(undefined, true);
  }
}
