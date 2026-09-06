import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = process.env.CSWORK_LSP_URL || 'http://127.0.0.1:4321';
const token = process.env.CSWORK_LSP_TOKEN;
if (!token) throw new Error('Set CSWORK_LSP_TOKEN for the isolated broker');
const ownerId = `lsp-test-${randomUUID()}`;
const checks = [
  {
    language: 'python',
    code: 'import math\nmath.',
    match: /sqrt/,
    position: { line: 1, character: 5 },
    valid: 'import math\nanswer = math.sqrt(9)\n',
    hover: { line: 1, character: 16 },
    signature: { line: 1, character: 19 },
    invalid: 'value = unknown_identifier\n',
  },
  {
    language: 'go',
    code: 'package main\nimport "fmt"\nfunc main() {\nfmt.\n}',
    match: /Println/,
    position: { line: 3, character: 4 },
    valid: 'package main\nimport "fmt"\nfunc main() {\nfmt.Println("hi")\n}',
    hover: { line: 3, character: 7 },
    signature: { line: 3, character: 16 },
    invalid: 'package main\nfunc main() { unknown_identifier() }\n',
  },
  {
    language: 'cpp',
    code: '#include <vector>\nint main() {\nstd::vector<int> values;\nvalues.\n}',
    match: /push_back/,
    position: { line: 3, character: 7 },
    valid:
      '#include <vector>\nint main() {\nstd::vector<int> values;\nvalues.push_back(1);\n}',
    hover: { line: 3, character: 12 },
    signature: { line: 3, character: 17 },
    invalid: 'int main() { return unknown_identifier; }\n',
  },
  {
    language: 'java',
    code: 'import java.util.ArrayList;\npublic class Main {\npublic static void main(String[] args) {\nArrayList<String> values = new ArrayList<>();\nvalues.\n}\n}',
    match: /^add\b|^add\(/,
    position: { line: 4, character: 7 },
    valid:
      'import java.util.ArrayList;\npublic class Main {\npublic static void main(String[] args) {\nArrayList<String> values = new ArrayList<>();\nvalues.add("hi");\n}\n}',
    hover: { line: 4, character: 9 },
    signature: { line: 4, character: 11 },
    invalid:
      'public class Main { public static void main(String[] args) { unknown_identifier(); } }\n',
  },
];
async function call(path, body) {
  const res = await fetch(url + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  const json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  return json;
}
for (const check of checks) {
  if (
    process.env.LSP_LANGUAGES &&
    !process.env.LSP_LANGUAGES.split(',').includes(check.language)
  )
    continue;
  const identity = {
    ownerId,
    documentId: randomUUID(),
    language: check.language,
  };
  const started = Date.now();
  try {
    let result;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await call('/v1/request', {
        ...identity,
        code: check.code,
        version: 1,
        action: 'completion',
        position: check.position,
      });
      if (result.result.items.some((item) => check.match.test(item.label)))
        break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    assert.ok(
      result.result.items.some((item) => check.match.test(item.label)),
      `${check.language} missing semantic ${check.match}; labels=${JSON.stringify(result.result.items.map((item) => item.label))}`,
    );
    assert.equal(result.version, 1);
    assert.ok(result.result.items.every((item) => !item.command && !item.data));
    console.log(
      `PASS ${check.language}: ${result.server}; ${result.result.items.length} semantic items; ${Date.now() - started}ms`,
    );
    const hover = await call('/v1/request', {
      ...identity,
      code: check.valid,
      version: 2,
      action: 'hover',
      position: check.hover,
    });
    assert.ok(
      hover.result?.contents,
      `${check.language}: expected typed hover`,
    );
    const signature = await call('/v1/request', {
      ...identity,
      code: check.valid,
      version: 2,
      action: 'signature',
      position: check.signature,
    });
    assert.ok(
      signature.result?.signatures?.length > 0,
      `${check.language}: expected parameter signature`,
    );
    let diagnostics;
    for (let attempt = 0; attempt < 4; attempt++) {
      diagnostics = await call('/v1/request', {
        ...identity,
        code: check.invalid,
        version: 3,
        action: 'diagnostics',
      });
      if (
        diagnostics.diagnostics.some((item) =>
          item.message.includes('unknown_identifier'),
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    assert.ok(
      diagnostics.diagnostics.some((item) =>
        item.message.includes('unknown_identifier'),
      ),
      `${check.language}: expected unknown identifier diagnostic`,
    );
    console.log(
      `PASS ${check.language}: hover + signature + semantic diagnostics; diagnosticsVersion=${diagnostics.diagnosticsVersion}`,
    );
  } finally {
    await call('/v1/close', identity);
  }
}
const health = await fetch(url + '/health', {
  headers: { Authorization: `Bearer ${token}` },
}).then((res) => res.json());
console.log(`Complete; live sessions=${health.sessions}`);

// The visible document starts at class on line 1; clangd sees the platform
// headers through -include, without adding lines to the user's document.
if (
  !process.env.LSP_LANGUAGES ||
  process.env.LSP_LANGUAGES.split(',').includes('cpp')
) {
  const identity = { ownerId, documentId: randomUUID(), language: 'cpp' };
  const cppContext =
    '#include <bits/stdc++.h>\nusing namespace std;\nstruct ListNode { int val; ListNode* next; };\n';
  try {
    const code =
      'class Solution {\npublic:\nvoid test(ListNode* head) {\nvector<int> values;\nvalues.\n}\n};';
    let result;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await call('/v1/request', {
        ...identity,
        cppContext,
        code,
        version: 1,
        action: 'completion',
        position: { line: 4, character: 7 },
      });
      if (result.result.items.some((item) => /push_back/.test(item.label)))
        break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(
      result.result.items.some((item) => /push_back/.test(item.label)),
      'hidden header vector completion',
    );
    const invalid =
      'class Solution {\npublic:\nint test(ListNode* head) { return missing_value; }\n};';
    let diagnostics;
    for (let attempt = 0; attempt < 5; attempt++) {
      diagnostics = await call('/v1/request', {
        ...identity,
        cppContext,
        code: invalid,
        version: 2,
        action: 'diagnostics',
      });
      if (diagnostics.diagnosticsVersion === 2) break;
    }
    const error = diagnostics.diagnostics.find((item) =>
      item.message.includes('missing_value'),
    );
    assert.ok(error, JSON.stringify(diagnostics));
    assert.equal(
      error.range.start.line,
      2,
      'diagnostics keep visible document line numbers',
    );
    assert.ok(
      !diagnostics.diagnostics.some((item) =>
        /unknown type name.*ListNode/.test(item.message),
      ),
    );
    console.log(
      'PASS cpp hidden headers: semantic completion and unshifted diagnostics',
    );
  } finally {
    await call('/v1/close', identity);
  }
}
