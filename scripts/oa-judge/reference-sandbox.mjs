/** Authored OA programs compile/run only in GoJudge, never on the verifier host.
 * Protocol and limits mirror lib/server/oj-engine.ts ordinary ACM C++20.
 */
import assert from 'node:assert/strict';
import { referenceExtension } from './reference-program.mjs';

export function assertNormalExit(result, label = 'program') {
  assert.equal(result.status, 'Accepted', label + ' must run normally');
  assert(
    result.exitStatus === undefined || result.exitStatus === 0,
    label + ' nonzero exit',
  );
}
export function createReferenceSandbox({ url, token, fetchImpl = fetch }) {
  const base = new URL(url);
  assert(
    base.protocol === 'https:' ||
      (base.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)),
  );
  assert(token, 'Authenticated sandbox required');
  const headers = {
    'content-type': 'application/json',
    authorization: 'Bearer ' + token,
  };
  async function execute(command, compiling = false) {
    // Do not retry compilation: a lost response may already own a cached file.
    let response;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        response = await fetchImpl(new URL('/run', base), {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(compiling ? 75000 : 45000),
          body: JSON.stringify({ cmd: [command] }),
        });
        break;
      } catch (error) {
        const transient =
          error?.name === 'TimeoutError' ||
          ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
            error?.cause?.code,
          );
        if (compiling || !transient || attempt === 5) throw error;
        console.warn(JSON.stringify({ event: 'oa_sandbox_retry', attempt }));
        await new Promise((done) =>
          setTimeout(done, Math.min(2 ** attempt, 8) * 1000),
        );
      }
    }
    assert(response.ok, 'Sandbox HTTP ' + response.status);
    const results = await response.json();
    assert(
      Array.isArray(results) && results.length === 1,
      'Invalid sandbox result',
    );
    return results[0];
  }
  function limits(input, cpu, clock, memory, output) {
    return {
      env: ['PATH=/usr/bin:/bin', 'LANG=C.UTF-8', 'HOME=/w'],
      files: [
        { content: input },
        { name: 'stdout', max: output, pipe: true },
        { name: 'stderr', max: Math.min(output, 65536), pipe: true },
      ],
      cpuLimit: Math.ceil(cpu * 1e9),
      clockLimit: Math.ceil(clock * 1e9),
      memoryLimit: memory,
      procLimit: 64,
    };
  }
  return {
    async withProgram(program, callback) {
      referenceExtension(program.language);
      assert.equal(typeof program.code, 'string');
      let cache = {};
      let value;
      let failed = false;
      let primaryError;
      let cleanupFailures = [];
      try {
        if (program.language === 'cpp') {
          const result = await execute(
            {
              ...limits('', 30, 60, 1073741824, 65536),
              args: [
                '/usr/bin/g++',
                '-std=c++20',
                '-O2',
                '-pipe',
                'main.cpp',
                '-o',
                'main',
              ],
              copyIn: { 'main.cpp': { content: program.code } },
              copyOutCached: ['main'],
              copyOutMax: 16777216,
            },
            true,
          );
          cache = result.fileIds ?? {};
          assertNormalExit(result, 'C++ compilation');
          assert(
            typeof cache.main === 'string' && cache.main,
            'Compiled artifact missing',
          );
        }
        value = await callback(async (input, spec) => {
          assert(spec.timeLimit > 0 && spec.timeLimit <= 10);
          assert(spec.memoryLimit >= 16384 && spec.memoryLimit <= 524288);
          assert(spec.outputLimit > 0 && spec.outputLimit <= 65536);
          return execute({
            ...limits(
              input,
              spec.timeLimit,
              Math.max(3, spec.timeLimit * 3),
              spec.memoryLimit * 1024,
              spec.outputLimit * 1024,
            ),
            args:
              program.language === 'python'
                ? ['/usr/bin/python3', '-I', 'main.py']
                : ['main'],
            copyIn:
              program.language === 'python'
                ? { 'main.py': { content: program.code } }
                : { main: { fileId: cache.main } },
          });
        });
      } catch (error) {
        failed = true;
        primaryError = error;
      } finally {
        // Attempt every returned artifact even on compilation/test failure.
        const cleanup = await Promise.allSettled(
          [...new Set(Object.values(cache))].map(async (id) => {
            assert(typeof id === 'string' && id, 'Invalid cached artifact');
            const response = await fetchImpl(
              new URL('/file/' + encodeURIComponent(id), base),
              {
                method: 'DELETE',
                headers,
                signal: AbortSignal.timeout(10000),
              },
            );
            assert(
              response.ok || response.status === 404,
              'Sandbox cached artifact cleanup failed',
            );
          }),
        );
        cleanupFailures = cleanup.filter((r) => r.status === 'rejected');
      }
      if (cleanupFailures.length)
        throw new AggregateError(
          [
            ...(failed ? [primaryError] : []),
            ...cleanupFailures.map((r) => r.reason),
          ],
          'Sandbox cache cleanup failed',
        );
      if (failed) throw primaryError;
      return value;
    },
  };
}
