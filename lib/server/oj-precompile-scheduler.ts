/** One interruptible, best-effort background task sharing the foreground worker. */
export class PrecompileScheduler {
  private foreground = 0;
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
    return !this.closed && !this.foreground && !this.active;
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
  async cancelBackground(id?: string) {
    const active = this.active;
    if (!active || (id !== undefined && active.id !== id)) return;
    active.controller.abort();
    await active.settled;
  }
  /** `key` adopts a background compile of the same program instead of aborting it. */
  async enterForeground(key?: string): Promise<() => void> {
    // Runs before the first await, preventing a new task during cancellation.
    this.foreground++;
    const active = this.active;
    if (active && key !== undefined && active.key === key) {
      active.adopted = true;
      await active.settled;
    } else await this.cancelBackground();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.foreground--;
    };
  }
  async close() {
    this.closed = true;
    await this.cancelBackground();
  }
}
