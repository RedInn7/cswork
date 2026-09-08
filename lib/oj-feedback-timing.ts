import { activeStatuses } from './oj-client';

type Clock = {
  now(): number;
  measure(name: string, options: PerformanceMeasureOptions): unknown;
};

/** Browser-local end-to-end timing. Never records code, user IDs, or problem IDs. */
export class FeedbackTiming {
  private attempt: {
    start: number;
    mode: 'run' | 'judge';
    id?: string;
  } | null = null;
  constructor(private readonly clock: Clock) {}
  start(mode: 'run' | 'judge') {
    this.attempt = { start: this.clock.now(), mode };
  }
  bind(id: string) {
    if (this.attempt) this.attempt.id = id;
  }
  cancel() {
    this.attempt = null;
  }
  finish(id: string, status: string): number | null {
    const attempt = this.attempt;
    if (!attempt || attempt.id !== id || activeStatuses.has(status))
      return null;
    this.attempt = null;
    const end = this.clock.now();
    try {
      this.clock.measure('cswork:oj:click-to-feedback', {
        start: attempt.start,
        end,
        detail: { mode: attempt.mode, status },
      });
    } catch {
      /* Older browsers may not implement User Timing level 3. */
    }
    return end - attempt.start;
  }
}
