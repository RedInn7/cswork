import { createHash } from 'node:crypto';
import { compile, cleanup, type CompiledProgram } from './oj-engine';
import type { Language } from '@/lib/problems';

type Compilation = Awaited<ReturnType<typeof compile>>;
type Entry = {
  compilation: Compilation;
  expires: number;
  leased: number;
  retired: boolean;
  background: boolean;
};

/** Worker-local, per-user cache. Compiled files stay inside go-judge, never on the host. */
export class CompiledProgramCache {
  private entries = new Map<string, Entry>();
  private warming = false;
  private closed = false;
  private key(owner: string, language: Language, source: string) {
    return createHash('sha256')
      .update(JSON.stringify([owner, language, source]))
      .digest('hex');
  }
  async warm(
    owner: string,
    language: Language,
    source: string,
    signal: AbortSignal,
  ): Promise<'cached' | 'warmed' | 'skipped' | 'failed'> {
    signal.throwIfAborted();
    if (
      this.closed ||
      this.warming ||
      this.capacity <= 0 ||
      language === 'python'
    )
      return 'skipped';
    this.warming = true;
    try {
      await this.prune();
      signal.throwIfAborted();
      if (this.closed) return 'skipped';
      const key = this.key(owner, language, source);
      if (this.entries.has(key)) return 'cached';
      const background = [...this.entries].filter(
        ([, e]) => e.background && !e.leased,
      );
      if (background.length >= 2) {
        if (!background.length) return 'skipped';
        await this.retire(...background[0]);
      }
      const compilation = await this.compiler(language, source, signal);
      let retained = false;
      try {
        signal.throwIfAborted();
        if (compilation.result.status !== 'Accepted') return 'failed';
        // Warm slots are independent of the foreground capacity.
        if (
          this.closed ||
          this.entries.has(key) ||
          [...this.entries.values()].filter((e) => e.background).length >= 2
        )
          return 'skipped';
        this.entries.set(key, {
          compilation,
          expires: this.now() + this.ttlMs,
          leased: 0,
          retired: false,
          background: true,
        });
        retained = true;
        return 'warmed';
      } finally {
        if (!retained) await this.dispose(compilation.program);
      }
    } finally {
      this.warming = false;
    }
  }
  constructor(
    private compiler = compile,
    private dispose = cleanup,
    // Foreground budget; up to two additional entries are reserved for warming.
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
  async acquire(
    owner: string,
    language: Language,
    source: string,
    signal: AbortSignal,
  ) {
    await this.prune();
    signal.throwIfAborted();
    // The wrapped source binds the function driver and compiler inputs, not only the editor text.
    // Compiler configuration changes take effect on worker restart, which starts with an empty cache.
    const key = this.key(owner, language, source);
    let entry = this.entries.get(key);
    const cacheHit = !!entry;
    if (entry) {
      // Lease before any asynchronous eviction so concurrent pruning cannot
      // dispose the binary that this acquisition is about to use.
      entry.leased++;
      if (entry.background) {
        entry.background = false;
        while (
          [...this.entries.values()].filter((e) => !e.background).length >
          this.capacity
        ) {
          const oldest = [...this.entries].find(
            ([candidate, e]) => candidate !== key && !e.background && !e.leased,
          );
          if (!oldest) {
            await this.retire(key, entry);
            break;
          }
          await this.retire(...oldest);
        }
      }
      if (!entry.retired) {
        this.entries.delete(key);
        this.entries.set(key, entry);
      }
    } else {
      const compilation = await this.compiler(language, source, signal);
      entry = {
        compilation,
        expires: this.now() + this.ttlMs,
        leased: 0,
        retired: true,
        background: false,
      };
      if (
        !this.closed &&
        compilation.result.status === 'Accepted' &&
        language !== 'python'
      ) {
        while (
          [...this.entries.values()].filter((e) => !e.background).length >=
            this.capacity &&
          this.capacity > 0
        ) {
          const candidates = [...this.entries];
          const oldest = candidates.find(
            ([, value]) => !value.background && !value.leased,
          );
          if (!oldest) break;
          await this.retire(...oldest);
        }
        if (
          [...this.entries.values()].filter((e) => !e.background).length <
            this.capacity &&
          !this.entries.has(key)
        ) {
          entry.retired = false;
          this.entries.set(key, entry);
        }
      }
      entry.leased++;
    }
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
    this.closed = true;
    for (const [key, entry] of this.entries) await this.retire(key, entry);
  }
}
