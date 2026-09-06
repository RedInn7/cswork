/** One interruptible, best-effort background task sharing the foreground worker. */
export class PrecompileScheduler {
  private foreground = 0;
  private closed = false;
  private active?: {
    id: string;
    controller: AbortController;
    settled: Promise<void>;
  };
  get activeId() {
    return this.active?.id;
  }
  get canStart() {
    return !this.closed && !this.foreground && !this.active;
  }
  start(id: string, task: (signal: AbortSignal) => Promise<unknown>): boolean {
    if (!this.canStart) return false;
    const controller = new AbortController();
    // Defer user task until the active record is installed synchronously.
    const record = { id, controller, settled: Promise.resolve() };
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
  async enterForeground(): Promise<() => void> {
    // Runs before the first await, preventing a new task during cancellation.
    this.foreground++;
    await this.cancelBackground();
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
