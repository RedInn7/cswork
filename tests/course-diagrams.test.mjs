/* oxlint-disable typescript/no-deprecated -- Mermaid exposes parsed vertices and effective security configuration only through this inspection API; production uses the supported public render API. */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  courseDiagramConfig,
  courseDiagramLabel,
  DIAGRAM_MAX_LENGTH,
  prepareCourseDiagram,
} from '../lib/course-diagram.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { default: mermaid } = await import('mermaid');
mermaid.initialize(courseDiagramConfig());
after(() => dom.window.close());

test('every real course Mermaid block parses under the exact production configuration', async (t) => {
  const directory = new URL('../content/lectures/', import.meta.url);
  let total = 0;
  for (const file of readdirSync(directory).filter((name) =>
    name.endsWith('.md'),
  )) {
    const body = readFileSync(new URL(file, directory), 'utf8');
    let ordinal = 0;
    for (const match of body.matchAll(/^```mermaid[^\n]*\n([\s\S]*?)^```/gm)) {
      ordinal += 1;
      total += 1;
      const parsed = await mermaid.parse(prepareCourseDiagram(match[1]));
      assert.ok(parsed.diagramType, `${file}, diagram ${ordinal}`);
    }
  }
  assert.ok(total >= 39, 'all 39 existing course diagrams must remain covered');
  t.diagnostic(`${total} actual course diagrams parsed without errors`);
});

test('author directives, frontmatter and oversized sources cannot alter renderer policy', () => {
  for (const source of [
    '%%{init: {"securityLevel":"loose","htmlLabels":true}}%%\nflowchart LR\n A-->B',
    '%% { init: {"dompurifyConfig":{"ADD_TAGS":["script"]}} } %%\nflowchart LR\n A-->B',
    '\ufeff---\nconfig:\n  securityLevel: loose\n---\nflowchart LR\n A-->B',
    '---\r\nconfig:\r\n  themeCSS: body { display:none }\r\n---\r\nflowchart LR\r\n A-->B',
    ' '.repeat(30),
    `flowchart LR\n A[${'a'.repeat(DIAGRAM_MAX_LENGTH)}]`,
  ])
    assert.throws(() => prepareCourseDiagram(source));
  assert.equal(
    prepareCourseDiagram(' \nflowchart LR\n A-->B\n '),
    'flowchart LR\n A-->B',
  );
  assert.equal(mermaid.mermaidAPI.getConfig().securityLevel, 'strict');
  assert.equal(mermaid.mermaidAPI.getConfig().htmlLabels, false);
});

test('strict parser strips executable label markup and never registers author callbacks', async () => {
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(
    prepareCourseDiagram(
      'flowchart LR\n A["<script>window.diagramPwned=1</script><img src=x onerror=window.diagramPwned=1>"] --> B[Safe]\n click B call diagramPwned()',
    ),
  );
  const vertices = diagram.db.getVertices();
  assert.doesNotMatch(vertices.get('A').text, /<script|onerror|diagramPwned/i);
  assert.equal(vertices.get('B').haveCallback, undefined);
  assert.equal(dom.window.diagramPwned, undefined);
  assert.equal(mermaid.mermaidAPI.getConfig().securityLevel, 'strict');
});

test('an invalid diagram does not prevent the next valid diagram from parsing', async () => {
  await assert.rejects(
    mermaid.parse(prepareCourseDiagram('flowchart LR\n A[broken')),
  );
  assert.equal(
    (
      await mermaid.parse(
        prepareCourseDiagram('sequenceDiagram\n Alice->>Bob: hello'),
      )
    ).diagramType,
    'sequence',
  );
  assert.equal(dom.window.document.querySelector('svg'), null);
  assert.equal(
    courseDiagramLabel('sequenceDiagram\n Alice->>Bob: hello'),
    '课程时序图',
  );
  assert.equal(
    courseDiagramLabel('stateDiagram-v2\n [*] --> Ready'),
    '课程状态图',
  );
  assert.equal(
    courseDiagramLabel('flowchart LR\n accTitle: 订单流程\n A-->B'),
    '订单流程',
  );
});
