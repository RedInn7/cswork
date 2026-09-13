import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Only called from the fresh-database, loopback-runner OA integration harness. */
export async function probeLargeInputs({
  db,
  request,
  identity,
  until,
  web,
  worker,
}) {
  const insert = (table, row) => {
    const keys = Object.keys(row);
    db.prepare(
      `INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`,
    ).run(...Object.values(row));
  };
  const base = db.prepare('SELECT * FROM oj_problems LIMIT 1').get();
  const version = db
    .prepare('SELECT * FROM oj_problem_versions WHERE id=?')
    .get(base.current_version_id);
  for (const large of [false, true]) {
    const id = large ? 'capacity-probe-large' : 'capacity-probe-small';
    const spec = {
      ...JSON.parse(version.spec_json),
      id,
      checker: 'tokens',
      timeLimit: 3,
      memoryLimit: 131072,
      outputLimit: 64,
    };
    const cases = [
      {
        name: 'public',
        input: '123\n',
        expectedOutput: '4\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: large ? 'x'.repeat(32 * 1024 * 1024) : '1234567\n',
        expectedOutput: large ? '33554432\n' : '8\n',
        hidden: true,
        weight: 1,
      },
    ];
    const vid = randomUUID();
    const checksum = createHash('sha256')
      .update(JSON.stringify({ schemaVersion: 1, problem: spec, cases }))
      .digest('hex');
    db.transaction(() => {
      insert('oj_problems', {
        ...base,
        id,
        published: 0,
        current_version_id: null,
      });
      insert('oj_problem_versions', {
        ...version,
        id: vid,
        problem_id: id,
        revision: 1,
        spec_json: JSON.stringify(spec),
        checksum,
      });
      for (const [ordinal, c] of cases.entries())
        insert('oj_test_cases', {
          id: randomUUID(),
          version_id: vid,
          ordinal,
          name: c.name,
          input: c.input,
          expected_output: c.expectedOutput,
          hidden: Number(c.hidden),
          weight: 1,
        });
      db.prepare(
        'UPDATE oj_problems SET published=1,current_version_id=? WHERE id=?',
      ).run(vid, id);
    })();
  }
  const peaks = { web: 0, worker: 0 };
  const sample = () => {
    for (const [name, process] of Object.entries({ web, worker })) {
      const status = readFileSync(`/proc/${process.pid}/status`, 'utf8');
      const match = /^VmHWM:\s+(\d+) kB$/m.exec(status);
      assert(match);
      peaks[name] = Math.max(peaks[name], Number(match[1]));
    }
  };
  sample();
  const timer = setInterval(sample, 100);
  try {
    const users = Array.from({ length: 10 }, () => {
      const email = `capacity-${randomUUID()}@example.test`;
      const user = identity(email);
      db.prepare(
        "INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,'gomall','test',?)",
      ).run(randomUUID(), email, Date.now());
      return user;
    });
    const started = Date.now();
    const submitted = await Promise.all(
      users.map(async (user, i) => {
        const large = i % 3 === 0;
        const result = await request('/api/oj/submissions', user, 201, {
          problemId: large ? 'capacity-probe-large' : 'capacity-probe-small',
          language: 'python',
          codingMode: 'acm',
          mode: 'judge',
          idempotencyKey: randomUUID(),
          code: 'import sys,time\ndata=sys.stdin.buffer.read()\nstart=time.time_ns()\ntime.sleep(0.3)\nprint(len(data))\nprint("CAPACITY",start,time.time_ns(),file=sys.stderr)\n',
        });
        return { ...result, user, large };
      }),
    );
    const apiMs = Date.now() - started;
    const intervals = [];
    for (const item of submitted) {
      const terminal = await until(() => {
        const row = db
          .prepare('SELECT * FROM submissions WHERE id=?')
          .get(item.id);
        return row?.finished_at !== null ? row : null;
      }, 180000);
      assert.equal(terminal.status, 'accepted');
      assert.equal(terminal.passed, 2);
      assert.equal(terminal.attempt, 1);
      const feedback = await request(
        `/api/oj/submissions/${item.id}`,
        item.user,
      );
      assert.equal(feedback.status, 'accepted');
      const results = db
        .prepare(
          'SELECT stderr FROM oj_results WHERE submission_id=? ORDER BY ordinal',
        )
        .all(item.id);
      assert.equal(results.length, 2);
      // Successful hidden-case diagnostics must stay private; use the public
      // case for sandbox concurrency and DB timestamps for full admission.
      assert.equal(results[1].stderr, null);
      const times = results.slice(0, 1).map((r) => {
        const m = /^CAPACITY (\d+) (\d+)$/m.exec(r.stderr);
        assert(m);
        return [BigInt(m[1]), BigInt(m[2])];
      });
      intervals.push({
        large: item.large,
        times,
        startedAt: terminal.started_at,
        finishedAt: terminal.finished_at,
        start: times[0][0],
        end: times.at(-1)[1],
      });
    }
    for (let i = 0; i < intervals.length; i++)
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i],
          b = intervals[j];
        if (a.large || b.large) {
          assert(
            a.end <= b.start || b.end <= a.start,
            'Large input must retain exclusive execution',
          );
          assert(
            a.finishedAt <= b.startedAt || b.finishedAt <= a.startedAt,
            'Large input worker lifetimes must remain exclusive',
          );
        }
      }
    const normal = intervals.filter((v) => !v.large);
    assert(
      normal.some((a, i) =>
        normal
          .slice(i + 1)
          .some((b) =>
            a.times.some(([start, end]) =>
              b.times.some(
                ([otherStart, otherEnd]) =>
                  start < otherEnd && otherStart < end,
              ),
            ),
          ),
      ),
      'Ordinary test cases must still execute concurrently',
    );
    sample();
    assert(
      peaks.web < 4 * 1024 * 1024 && peaks.worker < 4 * 1024 * 1024,
      'Production per-service 4 GiB cap',
    );
    console.log(
      JSON.stringify({
        event: 'large_input_mixed_load_verified',
        simultaneousSubmissions: 10,
        largeSubmissions: 4,
        inputBytes: 32 * 1024 * 1024,
        accepted: 10,
        apiMs,
        totalMs: Date.now() - started,
        peakRssKiB: peaks,
        exclusiveVerified: true,
        productionDataUsed: false,
      }),
    );
  } finally {
    clearInterval(timer);
  }
}
