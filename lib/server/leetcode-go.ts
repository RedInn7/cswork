import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const definitions: Record<string, string> = {
  TreeNode: 'type TreeNode struct { Val int; Left, Right *TreeNode }',
  ListNode: 'type ListNode struct { Val int; Next *ListNode }',
  Node: 'type Node struct { Val int; Next, Left, Right, Random, Prev, Child, Parent *Node }',
  Interval: 'type Interval struct { Start, End int }',
  MountainArray:
    'type MountainArray struct { Values []int; Calls int }\nfunc (m *MountainArray) get(i int) int { m.Calls++; if m.Calls>100 { panic("MountainArray.get exceeds 100 calls") }; return m.Values[i] }\nfunc (m *MountainArray) length() int { return len(m.Values) }',
};
function helpers(source: string, relevantOnly = false) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return Object.entries(definitions)
    .filter(
      ([name]) =>
        (!relevantOnly || new RegExp(`\\b${name}\\b`).test(source)) &&
        !new RegExp(`\\btype\\s+${name}\\b`).test(clean),
    )
    .map(([, s]) => s)
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
  return `package main\n\n${code}\n\n${helpers(code, true)}\n`;
}
export function buildLeetCodeGo(
  problemId: number,
  source: string,
  snippet: string,
): string {
  const code = source.replace(/^\s*package\s+\w+\s*;?/m, '');
  const declaration = official(problemId, snippet).replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
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
    .replace('var csnodes', `${code}\n${helpers(code)}\nvar csnodes`);
}
