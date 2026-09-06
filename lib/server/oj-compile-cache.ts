import { createHash } from 'node:crypto';
import { compile, cleanup, type CompiledProgram } from './oj-engine';
import type { Language } from '@/lib/problems';

type Compilation = Awaited<ReturnType<typeof compile>>;
type Entry = { compilation: Compilation; expires: number; leased: number; retired: boolean };

/** Worker-local, per-user cache. Compiled files stay inside go-judge, never on the host. */
export class CompiledProgramCache {
  private entries = new Map<string, Entry>();
  constructor(
    private compiler = compile,
    private dispose = cleanup,
    private capacity = 8,
    private ttlMs = 5 * 60_000,
    private now = Date.now,
  ) {}
  private async retire(key: string, entry: Entry) {
    if (this.entries.get(key) === entry) this.entries.delete(key);
    entry.retired = true;
    if (!entry.leased) await this.dispose(entry.compilation.program);
  }
  async prune() {
    for (const [key, entry] of this.entries)
      if (entry.expires <= this.now()) await this.retire(key, entry);
  }
  async acquire(owner: string, language: Language, source: string, signal: AbortSignal) {
    await this.prune();
    signal.throwIfAborted();
    // The wrapped source binds the function driver and compiler inputs, not only the editor text.
    // Compiler configuration changes take effect on worker restart, which starts with an empty cache.
    const key = createHash('sha256')
      .update(JSON.stringify([owner, language, source]))
      .digest('hex');
    let entry = this.entries.get(key);
    const cacheHit = !!entry;
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    } else {
      const compilation = await this.compiler(language, source, signal);
      entry = { compilation, expires: this.now() + this.ttlMs, leased: 0, retired: true };
      if (compilation.result.status === 'Accepted' && language !== 'python') {
        while (this.entries.size >= this.capacity && this.capacity > 0) {
          const oldest = [...this.entries].find(([, value]) => !value.leased);
          if (!oldest) break;
          await this.retire(...oldest);
        }
        if (this.entries.size < this.capacity && !this.entries.has(key)) {
          entry.retired = false;
          this.entries.set(key, entry);
        }
      }
    }
    entry.leased++;
    const acquired = entry;
    let released = false;
    return {
      result: entry.compilation.result,
      // Bridge flags and custom-input settings belong to this submission, never to the shared entry.
      program: {
        ...entry.compilation.program,
        cache: { ...entry.compilation.program.cache },
      } as CompiledProgram,
      cacheHit,
      release: async (invalidate = false) => {
        if (released) return;
        released = true;
        acquired.leased--;
        if (invalidate && !acquired.retired) await this.retire(key, acquired);
        else if (acquired.retired && !acquired.leased)
          await this.dispose(acquired.compilation.program);
      },
    };
  }
  async close() {
    for (const [key, entry] of this.entries) await this.retire(key, entry);
  }
}
