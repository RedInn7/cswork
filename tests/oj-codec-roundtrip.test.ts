import assert from "node:assert/strict";
import test from "node:test";
import {
  runCodecRoundTrip,
  type CodecRunner,
} from "../lib/server/oj-codec-roundtrip";
import type { OjProblemSpec } from "../lib/oj-types";
import type { CompiledProgram, EngineResult } from "../lib/server/oj-engine";
const spec = {
  id: "lc-297",
  checker: "design-lc-297",
  timeLimit: 2,
  memoryLimit: 262144,
  outputLimit: 64,
} as OjProblemSpec;
const program = {
  language: "python",
  source: "",
  cache: {},
} as CompiledProgram;
const input = JSON.stringify([
  ["Codec", "roundTrip", "roundTrip"],
  [[], [[1, null, 2]], [[]]],
]);
const ok = (stdout: string, time = 100_000_000): EngineResult => ({
  status: "Accepted",
  time,
  memory: 1024,
  files: { stdout, stderr: "" },
});
const invoke = (run: CodecRunner, limits = spec) =>
  runCodecRoundTrip(program, input, limits, new AbortController().signal, run);

test("opaque student format crosses fresh runs, second input excludes original trees", async () => {
  const calls: unknown[] = [];
  const budgets: number[] = [];
  const runner: CodecRunner = async (p, raw, budget) => {
    assert.equal(p, program);
    const payload = JSON.parse(raw);
    calls.push(payload);
    budgets.push(budget.timeLimit);
    return calls.length === 1
      ? ok(JSON.stringify(["custom(1,x,2)", "empty"]))
      : ok(JSON.stringify([[1, null, 2], []]));
  };
  const result = await invoke(runner);
  assert.deepEqual(calls, [
    { operation: "serialize", trees: [[1, null, 2], []] },
    { operation: "deserialize", data: ["custom(1,x,2)", "empty"] },
  ]);
  assert.deepEqual(budgets, [2, 1.9]);
  assert.equal(result.time, 200_000_000);
  assert.equal(result.memory, 1024);
  assert.deepEqual(JSON.parse(result.files!.stdout), [null, [1, null, 2], []]);
});
test("direct echo of serialize input fails before deserialization", async () => {
  let calls = 0;
  const result = await invoke(async (_p, raw) => {
    calls++;
    return ok(raw);
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "Wrong Answer");
  assert.equal(result.files!.stdout, "");
});
test("serialize accepts arbitrary empty strings but requires one string per tree", async () => {
  for (const value of [[], ["one"], [1, 2], [null, null], ["x", "y", "z"]]) {
    let calls = 0;
    const result = await invoke(async () => {
      calls++;
      return ok(JSON.stringify(value));
    });
    assert.equal(calls, 1);
    assert.equal(result.files!.stdout, "");
  }
  let calls = 0;
  const result = await invoke(async () =>
    ok(JSON.stringify(++calls === 1 ? ["", ""] : [[1, null, 2], []])),
  );
  assert.equal(calls, 2);
  assert.notEqual(result.files!.stdout, "");
});
test("malformed decoded nodes and missing tree records become wrong answer", async () => {
  for (const value of [[[true], []], [[1.5], []], [[null]], { trees: [] }]) {
    let calls = 0;
    const result = await invoke(async () =>
      ok(JSON.stringify(++calls === 1 ? ["a", "b"] : value)),
    );
    assert.equal(result.files!.stdout, "");
    assert.equal(result.status, "Wrong Answer");
  }
});
test("CPU totals cannot double the case allowance", async () => {
  let calls = 0;
  const result = await invoke(async () =>
    ++calls === 1
      ? ok('["a","b"]', 1_900_000_000)
      : ok("[[1,null,2],[]]", 200_000_000),
  );
  assert.equal(result.status, "Time Limit Exceeded");
  assert.equal(result.time, 2_100_000_000);
  assert.equal(result.files!.stdout, "");
  calls = 0;
  const exhausted = await invoke(async () => {
    calls++;
    return ok('["a","b"]', 2_000_000_000);
  });
  assert.equal(calls, 1);
  assert.equal(exhausted.status, "Time Limit Exceeded");
});
test("aggregate output counts both phases and stderr, preserving no private intermediate output", async () => {
  let calls = 0;
  const result = await invoke(
    async () => (++calls === 1 ? ok('["private","b"]') : ok("[[1,null,2],[]]")),
    { ...spec, outputLimit: 25 / 1024 },
  );
  assert.equal(result.status, "Output Limit Exceeded");
  assert.equal(result.files!.stdout, "");
  assert.equal(result.files!.stderr, "");
  const error = await invoke(async () => ({
    status: "Memory Limit Exceeded",
    time: 1,
    memory: 2048,
    files: { stdout: "private tree", stderr: "private serialization" },
    error: "private runner detail",
  }));
  assert.equal(error.status, "Memory Limit Exceeded");
  assert.equal(JSON.stringify(error).includes("private"), false);
});
test("runner collection OLE survives sanitization and no second execution", async () => {
  let calls = 0;
  const result = await invoke(async () => {
    calls++;
    return {
      ...ok("secret"),
      fileError: [
        { name: "stdout", type: "CopyOutSizeExceeded", message: "secret" },
      ],
    };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.fileError, [
    { name: "stdout", type: "CopyOutSizeExceeded" },
  ]);
  assert.equal(result.files!.stdout, "");
});
test("caller cancellation and missing CPU accounting fail without a second run", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runCodecRoundTrip(program, input, spec, controller.signal, async () => {
      throw Error("should not run");
    }),
  );
  await assert.rejects(
    invoke(async () => ({
      status: "Accepted",
      files: { stdout: '["a","b"]' },
    })),
    /CPU accounting/,
  );
});

test("ignoring deserialize data and returning another legal tree is WA even without expected output", async () => {
  let calls = 0;
  const result = await invoke(async () =>
    ok(JSON.stringify(++calls === 1 ? ["a", "b"] : [[9], []])),
  );
  assert.equal(result.status, "Wrong Answer");
  assert.equal(result.files!.stdout, "");
});

test('stage two RE, TLE and OLE retain verdict and discard private serialization', async () => {
  for (const status of ['Runtime Error', 'Time Limit Exceeded', 'Output Limit Exceeded']) {
    let calls = 0;
    const result = await invoke(async () => ++calls === 1 ? ok('["private","b"]') : {
      status, time: 20_000_000, memory: 4096,
      files: { stdout: 'private serialized tree', stderr: 'private debug detail' },
    });
    assert.equal(calls, 2);
    assert.equal(result.status, status);
    assert.equal(result.time, 120_000_000);
    assert.equal(result.memory, 4096);
    assert.equal(JSON.stringify(result).includes('private'), false);
  }
});
