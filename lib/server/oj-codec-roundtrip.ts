import type { OjProblemSpec } from "../oj-types";
import type { CompiledProgram, EngineResult } from "./oj-engine";

export type CodecRunner = (
  program: CompiledProgram,
  input: string,
  spec: OjProblemSpec,
  signal: AbortSignal,
) => Promise<EngineResult>;

/** Run each half in a fresh sandbox: the second half receives only serialized data. */
export async function runCodecRoundTrip(
  program: CompiledProgram,
  input: string,
  spec: OjProblemSpec,
  signal: AbortSignal,
  run: CodecRunner,
): Promise<EngineResult> {
  if (
    !["lc-297", "lc-449"].includes(spec.id) ||
    spec.checker !== `design-lc-${spec.id.slice(3)}`
  )
    throw new Error("Invalid fixed codec identity");
  const cpuBudget = spec.timeLimit * 1e9;
  const outputBudget = Math.floor(spec.outputLimit * 1024);
  if (
    !Number.isFinite(cpuBudget) ||
    cpuBudget <= 0 ||
    !Number.isSafeInteger(outputBudget) ||
    outputBudget <= 0
  )
    throw new Error("Invalid codec resource budget");
  let usedCpu = 0,
    usedOutput = 0,
    peakMemory = 0;
  const clean = (
    status: string,
    stdout = "",
    fileError?: EngineResult["fileError"],
  ): EngineResult => ({
    status,
    time: usedCpu,
    memory: peakMemory,
    files: { stdout, stderr: "" },
    ...(fileError
      ? { fileError: fileError.map(({ name, type }) => ({ name, type })) }
      : {}),
  });
  // An explicit status also rejects malformed output in custom runs without an expected file.
  const wrong = () => clean("Wrong Answer");
  let trees: unknown[];
  try {
    const trace: unknown = JSON.parse(input);
    if (!Array.isArray(trace) || trace.length !== 2) return wrong();
    const [ops, params] = trace;
    if (
      !Array.isArray(ops) ||
      !Array.isArray(params) ||
      ops.length < 2 ||
      ops.length !== params.length ||
      ops[0] !== "Codec" ||
      !Array.isArray(params[0]) ||
      params[0].length !== 0
    )
      return wrong();
    trees = [];
    for (let i = 1; i < ops.length; i++) {
      if (
        ops[i] !== "roundTrip" ||
        !Array.isArray(params[i]) ||
        params[i].length !== 1 ||
        !Array.isArray(params[i][0])
      )
        return wrong();
      trees.push(params[i][0]);
    }
  } catch {
    return wrong();
  }
  const deadline = AbortSignal.timeout(
    Math.max(1, Math.ceil(Math.max(3, spec.timeLimit * 3) * 1000)),
  );
  const combined = AbortSignal.any([signal, deadline]);
  const execute = async (payload: unknown): Promise<EngineResult | null> => {
    signal.throwIfAborted();
    if (deadline.aborted || usedCpu >= cpuBudget)
      return clean("Time Limit Exceeded");
    if (usedOutput >= outputBudget) return clean("Output Limit Exceeded");
    let result: EngineResult;
    try {
      result = await run(
        program,
        JSON.stringify(payload) + "\n",
        {
          ...spec,
          timeLimit: (cpuBudget - usedCpu) / 1e9,
          outputLimit: (outputBudget - usedOutput) / 1024,
        },
        combined,
      );
    } catch (error) {
      signal.throwIfAborted();
      if (deadline.aborted) return clean("Time Limit Exceeded");
      throw error;
    }
    signal.throwIfAborted();
    if (
      typeof result.time !== "number" ||
      !Number.isFinite(result.time) ||
      result.time < 0
    )
      throw new Error("Runner omitted codec CPU accounting");
    usedCpu += result.time;
    peakMemory = Math.max(peakMemory, result.memory || 0);
    usedOutput +=
      Buffer.byteLength(result.files?.stdout || "") +
      Buffer.byteLength(result.files?.stderr || "");
    if (usedOutput > outputBudget) return clean("Output Limit Exceeded");
    if (usedCpu > cpuBudget || deadline.aborted)
      return clean("Time Limit Exceeded");
    if (result.status !== "Accepted" || result.fileError?.length)
      return clean(result.status, "", result.fileError);
    try {
      parsed = JSON.parse(result.files?.stdout || "");
    } catch {
      return wrong();
    }
    return null;
  };
  let parsed: unknown;
  const firstFailure = await execute({ operation: "serialize", trees });
  if (firstFailure) return firstFailure;
  if (
    !Array.isArray(parsed) ||
    parsed.length !== trees.length ||
    parsed.some(
      (value) => typeof value !== "string" || /[\uD800-\uDFFF]/u.test(value),
    )
  )
    return wrong();
  const data = parsed;
  const secondFailure = await execute({ operation: "deserialize", data });
  if (secondFailure) return secondFailure;
  if (
    !Array.isArray(parsed) ||
    parsed.length !== trees.length ||
    parsed.some(
      (tree) =>
        !Array.isArray(tree) ||
        tree.length > 20001 ||
        tree.some((value) => value !== null && !Number.isSafeInteger(value)),
    )
  )
    return wrong();
  if (
    parsed.some((tree, i) => {
      const original = trees[i] as unknown[];
      return (
        tree.length !== original.length ||
        tree.some((value: unknown, j: number) => value !== original[j])
      );
    })
  )
    return wrong();
  return clean("Accepted", JSON.stringify([null, ...parsed]) + "\n");
}
