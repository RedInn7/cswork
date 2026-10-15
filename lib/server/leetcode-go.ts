import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const definitions: Record<string, string> = {
  TreeNode: 'type TreeNode struct { Val int; Left, Right *TreeNode }',
  ListNode: 'type ListNode struct { Val int; Next *ListNode }',
  Node: 'type Node struct { Val int; Next, Left, Right, Random, Prev, Child, Parent *Node }',
  Interval: 'type Interval struct { Start, End int }',
  // One package cannot hide a field, so the array and the call count live only
  // in the closures the judge builds (scripts/leetcode-mode/go/runtime.go).
  MountainArray:
    'type MountainArray struct { get_ func(int) int; length_ func() int }\nfunc (m *MountainArray) get(i int) int { return m.get_(i) }\nfunc (m *MountainArray) length() int { return m.length_() }',
};
// What the template shipped before the call budget moved into closures (40e7397d7).
const legacyMountainArray =
  'type MountainArray struct { Values []int; Calls int }\nfunc (m *MountainArray) get(i int) int { m.Calls++; if m.Calls>100 { panic("MountainArray.get exceeds 100 calls") }; return m.Values[i] }\nfunc (m *MountainArray) length() int { return len(m.Values) }';
/**
 * A draft saved from an older template keeps that template's definition. Swap
 * it, token for token (any whitespace, gofmt's dropped semicolons), for today's
 * so the draft still runs; code that reads the old fields then fails to build.
 */
export function upgradeLegacy(source: string, legacy: string, current: string) {
  const tokens = legacy.match(/\w+|[^\w\s;]/g)!;
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s;]*');
  return source.replace(new RegExp(pattern), () => current);
}
const clean = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
/**
 * Package-level (Go) or top-level (Java) text only: no comments, literals, or
 * `{...}` bodies, where a local or nested type may shadow X.
 */
export function packageLevel(source: string) {
  let depth = 0;
  let top = '';
  for (const ch of source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`[^`]*`|"""(?:\\[\s\S]|[^\\])*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g,
    ' ',
  )) {
    if (ch === '}') depth--;
    if (depth === 0) top += ch;
    if (ch === '{') depth++;
  }
  return top;
}
/** The template's own definitions of the types its signature uses. */
function helpers(snippet: string) {
  return Object.entries(definitions)
    .filter(
      ([name]) =>
        new RegExp(`\\b${name}\\b`).test(snippet) &&
        !new RegExp(`\\btype\\s+${name}\\b`).test(clean(snippet)),
    )
    .map(([, s]) => s)
    .join('\n');
}
/**
 * The runtime uses only cswPlatformX. Like LeetCode, X itself exists only when
 * the official signature uses it, and then it is one type: the learner's
 * package-level definition (our template ships one) or ours.
 */
function platform(signature: string, code: string) {
  const top = packageLevel(code);
  return Object.entries(definitions)
    .map(([name, definition]) => {
      const own = `cswPlatform${name}`;
      if (!new RegExp(`\\b${name}\\b`).test(clean(signature)))
        return definition.replace(new RegExp(`\\b${name}\\b`, 'g'), own);
      // ponytail: a grouped `type ( X ... )` is not seen and reports X redeclared.
      const alias = `type ${own} = ${name}`;
      return new RegExp(`\\btype\\s+${name}\\b`).test(top)
        ? alias
        : `${definition}\n${alias}`;
    })
    .join('\n');
}
function official(problemId: number, snippet: string) {
  return (
    snippet ||
    (problemId === 1644
      ? 'func lowestCommonAncestor(root, p, q *TreeNode) *TreeNode {\n    return nil\n}'
      : '')
  );
}
export function getLeetCodeGoTemplate(
  problemId: number,
  snippet: string,
): string {
  const code = official(problemId, snippet);
  return `package main\n\n${code}\n\n${helpers(code)}\n`;
}
export function buildLeetCodeGo(
  problemId: number,
  source: string,
  snippet: string,
): string {
  const code = upgradeLegacy(
    source.replace(/^\s*package\s+\w+\s*;?/m, ''),
    legacyMountainArray,
    definitions.MountainArray,
  );
  const signature = official(problemId, snippet);
  const declaration = signature.replace(/\/\*[\s\S]*?\*\//g, '');
  const methods = [
    ...declaration.matchAll(/func\s*\([^)]*\)\s*(\w+)\s*\(/g),
  ].map((m) => m[1]);
  let dispatch: string;
  if (methods.length) {
    dispatch = `ctor := csreflect.ValueOf(Constructor)\nif q["kind"]=="codec" { value:=ctor.Call(nil)[0]; obj:=csreflect.New(value.Type());obj.Elem().Set(value); instance:=obj.Interface().(*${declaration.match(/func\s+Constructor\([^)]*\)\s*(\w+)/)?.[1]}); out:=[]interface{}{}; for _, x:=range q["args"].([]interface{}) { var f interface{}; switch q["operation"] {${methods.map((m) => `case ${JSON.stringify(m)}: f=instance.${m}`).join(';')}; default:panic("Unknown codec operation") }; r,_:=cscall(f,[]interface{}{x});out=append(out,r) };result=out } else { ops:=q["operations"].([]interface{}); ps:=q["parameters"].([]interface{}); value:=ctor.Call(csargs(ps[0].([]interface{}),ctor))[0]; obj:=csreflect.New(value.Type());obj.Elem().Set(value); instance:=obj.Interface().(*${declaration.match(/func\s+Constructor\([^)]*\)\s*(\w+)/)?.[1]});out:=[]interface{}{nil};for i:=1;i<len(ops);i++ {var f interface{};switch csstrings.ToLower(ops[i].(string)) {${methods.map((m) => `case ${JSON.stringify(m.toLowerCase())}:f=instance.${m}`).join(';')};default:panic("Unknown design method")};r,_:=cscall(f,ps[i].([]interface{}));out=append(out,r)};result=out }`;
  } else {
    const name = declaration.match(/func\s+(\w+)\s*\(/)?.[1];
    if (!name) throw new Error(`Missing Go function for ${problemId}`);
    dispatch = `result,args=cscall(${name},q["args"].([]interface{}))`;
  }
  const runtime = readFileSync(
    join(process.cwd(), 'scripts/leetcode-mode/go/runtime.go'),
    'utf8',
  );
  // User import declarations must precede all helper declarations.
  return runtime
    .replace('// CSWORK_DISPATCH', dispatch)
    .replace('var csnodes', () => `${code}\n${platform(signature, code)}\nvar csnodes`);
}
