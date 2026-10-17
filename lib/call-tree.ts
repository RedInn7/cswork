/**
 * The recursion tree of one Python debugger run (lib/python-debugger.ts), rebuilt from the
 * recorded steps: a step whose frame serial is new opens a call under its caller (the
 * tracer's `parents`, else the call one level shallower on the stack); a 'return' step gives
 * the call its value.
 */
import type { TraceStep } from './python-debugger';

export const MAX_CALL_NODES = 400;

export type CallNode = {
  frame: number;
  /** The code's qualified name, e.g. `Solution.climb.<locals>.go`. */
  func: string;
  /** `i=3, j=0`: the parameters as the call's first step saw them (no self or cls). */
  args: string;
  /** What it returned; undefined while it never did (the trace was cut first). */
  ret?: string;
  /** It ended by raising an exception: ret is then not a real return value. */
  raised?: true;
  /** Index of the call's first step, where the debugger jumps to. */
  firstStep: number;
  /** Calls of this function with these same arguments, this one included. */
  repeat: number;
  children: CallNode[];
};
export type CallTree = {
  roots: CallNode[];
  size: number;
  /** More than MAX_CALL_NODES calls: the later ones are left out. */
  cut: boolean;
  /** Some call runs inside another call of the same function (directly or through others). */
  recursive: boolean;
};

export function buildCallTree(
  steps: readonly TraceStep[],
  params: Readonly<Record<number, readonly string[]>> = {},
  parents: Readonly<Record<number, number>> = {},
): CallTree {
  const roots: CallNode[] = [],
    stack: CallNode[] = [],
    byFrame = new Map<number, CallNode>(),
    same = new Map<string, CallNode[]>();
  let cut = false,
    recursive = false;
  steps.forEach((step, i) => {
    // A resumed generator keeps its serial (see TRACER_SOURCE), so it stays one node.
    let node = byFrame.get(step.frame);
    if (!node) {
      if (byFrame.size >= MAX_CALL_NODES) {
        // Keep reading: calls already drawn still get their return values.
        cut = true;
        return;
      }
      const vars = new Map(step.vars);
      const args = (params[step.frame] ?? [])
        .filter((name) => name !== 'self' && name !== 'cls' && vars.has(name))
        .map((name) => `${name}=${vars.get(name)}`)
        .join(', ');
      node = { frame: step.frame, func: step.func, args, firstStep: i, repeat: 1, children: [] };
      // Outermost first. parseTrace keeps only parents older than their call, so this ends.
      let callers: CallNode[] = [];
      for (let f = parents[step.frame]; byFrame.has(f); f = parents[f]) callers.unshift(byFrame.get(f)!);
      if (!callers.length) callers = stack.slice(0, step.depth);
      (callers.at(-1)?.children ?? roots).push(node);
      recursive ||= callers.some((caller) => caller.func === step.func);
      byFrame.set(step.frame, node);
      const key = `${step.func}(${args})`;
      const group = same.get(key);
      if (group) group.push(node);
      else same.set(key, [node]);
    }
    stack[step.depth] = node;
    stack.length = step.depth + 1;
    if (step.kind === 'return') {
      node.ret = step.ret ?? '';
      if (step.raised) node.raised = true;
    }
  });
  for (const group of same.values()) for (const node of group) node.repeat = group.length;
  return { roots, size: byFrame.size, cut, recursive };
}
