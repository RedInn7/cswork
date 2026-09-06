import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const definitions: Record<string, string> = {
  TreeNode:
    'class TreeNode { int val; TreeNode left, right; TreeNode() {} TreeNode(int v) { val=v; } TreeNode(int v,TreeNode l,TreeNode r) {val=v;left=l;right=r;} }',
  ListNode:
    'class ListNode { int val; ListNode next; ListNode() {} ListNode(int v) {val=v;} ListNode(int v,ListNode n) {val=v;next=n;} }',
  Node: 'class Node { int val; Node next,left,right,random,prev,child,parent; Node() {} Node(int v){val=v;} Node(int v,Node n){val=v;next=n;} Node(int v,Node l,Node r){val=v;left=l;right=r;} Node(int v,Node l,Node r,Node n){val=v;left=l;right=r;next=n;} }',
  Interval:
    'class Interval { int start,end; Interval() {} Interval(int s,int e){start=s;end=e;} }',
  MountainArray:
    'class MountainArray { int[] values; int calls; public int get(int i){if(++calls>100)throw new IllegalStateException("MountainArray.get exceeds 100 calls");return values[i];} public int length(){return values.length;} }',
};
function helpers(source: string, relevantOnly = false) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return Object.entries(definitions)
    .filter(
      ([name]) =>
        (!relevantOnly || new RegExp(`\\b${name}\\b`).test(source)) &&
        !new RegExp(`\\b(?:class|interface)\\s+${name}\\b`).test(clean),
    )
    .map(([, code]) => code)
    .join('\n');
}
export function getLeetCodeJavaTemplate(
  _problemId: number,
  snippet: string,
): string {
  return `import java.util.*;\nimport java.math.*;\n\n${snippet.replace(/\bpublic\s+class\s+/g, 'class ')}\n\n${helpers(snippet, true)}\n`;
}
export function buildLeetCodeJava(
  _problemId: number,
  source: string,
  _snippet: string,
): string {
  const code = source
    .replace(/^\s*package\s+[^;]+;/m, '')
    .replace(/\bpublic\s+class\s+/g, 'class ');
  return `import java.util.*;\nimport java.math.*;\n${code}\n${helpers(code)}\n${readFileSync(join(process.cwd(), 'scripts/leetcode-mode/java/runtime.java'), 'utf8')}\npublic class Main { public static void main(String[] a) throws Exception { CsworkRuntime.main(a); } }\n`;
}
