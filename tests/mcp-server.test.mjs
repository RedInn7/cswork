import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { after, before, test } from 'node:test';

// The stdio MCP server (tools/mcp/cswork-mcp.mjs) against a stand-in for cswork.org.
const TOKEN = `cswork_pat_${'a'.repeat(43)}`;
const seen = [];
const problem = {
  id: 'lc-1',
  title: '两数之和',
  difficulty: '简单',
  translations: {
    en: { title: 'Two Sum', description: 'Find two numbers.', input: 'n then nums', output: 'two indices', explanation: '', hints: [] },
  },
  timeLimit: 1,
  memoryLimit: 256,
  languages: ['python', 'cpp'],
  codingModes: ['leetcode', 'acm'],
  leetcodeTemplates: { python: 'class Solution:\n    def twoSum(self, nums, target): ...' },
  samples: [{ name: '样例 1', input: '4 9\n2 7 11 15', expectedOutput: '0 1' }],
  sourceStatement: null,
};
let polls = 0;
const routes = {
  'GET /api/oj/daily': () => ({ daily: { date: '2026-10-14', id: 'lc-1', kind: 'lc', title: '两数之和', difficulty: '简单' } }),
  'GET /api/oj/problems/lc-1': () => problem,
  'GET /api/oj/library': () => ({
    items: [{ id: 'lc-1', number: 1, titleZh: '两数之和', titleEn: 'Two Sum', difficulty: '简单', topics: ['哈希表'], judgeProblemId: 'lc-1' }],
    total: 1,
    page: 1,
  }),
  'GET /api/oj/oa-library': () => ({
    items: [{ id: 'oa-acme-1', companyName: 'Acme', number: 1, title: 'Widgets', topics: [], judgeProblemId: 'oa-acme-1' }],
    total: 1,
    page: 1,
  }),
  'POST /api/oj/submissions': (body) => ({
    id: 'sub-1',
    mode: body.mode,
    language: body.language,
    codingMode: body.codingMode,
    status: 'running',
    passed: 0,
    total: 1,
    cases: [],
  }),
  'GET /api/oj/submissions/sub-1': () =>
    ++polls < 2
      ? { id: 'sub-1', mode: 'run', language: 'python', status: 'running', passed: 0, total: 1, cases: [] }
      : {
          id: 'sub-1',
          mode: 'run',
          language: 'python',
          codingMode: 'acm',
          status: 'wrong_answer',
          passed: 0,
          total: 1,
          runtimeMs: 12,
          memoryKb: 9216,
          cases: [{ ordinal: 0, hidden: false, status: 'wrong_answer', runtimeMs: 12, stdin: '4 9', expected: '0 1', stdout: '1 0', stderr: '' }],
        },
};
const server = createServer((request, response) => {
  let text = '';
  request.on('data', (chunk) => (text += chunk));
  request.on('end', () => {
    const url = new URL(request.url, 'http://x');
    seen.push({ method: request.method, url, headers: request.headers, body: text ? JSON.parse(text) : undefined });
    const route = routes[`${request.method} ${url.pathname}`];
    const unauthorized = request.headers.authorization !== `Bearer ${TOKEN}`;
    response.writeHead(unauthorized ? 401 : route ? 200 : 404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(unauthorized ? { error: 'The access token is invalid or revoked' } : route ? route(seen.at(-1).body) : { error: 'nope' }));
  });
});
let base;
before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function start(env = {}) {
  const child = spawn(process.execPath, ['tools/mcp/cswork-mcp.mjs'], {
    env: { PATH: process.env.PATH, CSWORK_BASE_URL: base, CSWORK_TOKEN: TOKEN, CSWORK_POLL_MS: '10', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const waiting = new Map();
  const lines = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line);
    lines.push(message);
    waiting.get(message.id)?.(message);
  });
  let next = 0;
  return {
    child,
    lines,
    send: (raw) => child.stdin.write(`${raw}\n`),
    request(method, params) {
      const id = ++next;
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      return new Promise((resolve) => waiting.set(id, resolve));
    },
    notify: (method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`),
    stop: () => child.kill(),
  };
}
const text = (reply) => reply.result.content.map((c) => c.text).join('\n');

test('initialize handshake, tool listing and protocol errors', async () => {
  const mcp = start();
  try {
    const init = await mcp.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    assert.equal(init.jsonrpc, '2.0');
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'cswork');
    assert.deepEqual(init.result.capabilities, { tools: {} });
    // An unknown version gets the newest one the server speaks.
    assert.equal((await mcp.request('initialize', { protocolVersion: '1999-01-01' })).result.protocolVersion, '2025-06-18');
    mcp.notify('notifications/initialized');
    assert.deepEqual((await mcp.request('ping')).result, {});
    const { tools } = (await mcp.request('tools/list')).result;
    assert.deepEqual(
      tools.map((t) => t.name),
      ['get_daily_problem', 'search_problems', 'get_problem', 'run_code', 'submit_code', 'get_submission'],
    );
    for (const tool of tools) {
      assert.equal(tool.inputSchema.type, 'object');
      assert.equal(typeof tool.description, 'string');
      assert.equal('run' in tool, false);
    }
    assert.equal(tools.find((t) => t.name === 'submit_code').annotations.readOnlyHint, false);
    assert.equal((await mcp.request('nope/method')).error.code, -32601);
    assert.equal((await mcp.request('tools/call', { name: 'nope' })).error.code, -32602);
    assert.equal((await mcp.request('tools/call', { name: 'get_problem', arguments: {} })).error.code, -32602);
    assert.equal(
      (await mcp.request('tools/call', { name: 'run_code', arguments: { problem_id: 'lc-1', language: 'rust', code: 'x' } })).error.code,
      -32602,
    );
    mcp.send('{not json');
    await mcp.request('ping');
    assert.ok(mcp.lines.some((m) => m.error?.code === -32700 && m.id === null));
    // Notifications never get a reply: every reply so far answers a request.
    assert.ok(mcp.lines.every((m) => m.id !== undefined));
  } finally {
    mcp.stop();
  }
});

test('tools call cswork with the bearer token and format the results', async () => {
  const mcp = start();
  try {
    await mcp.request('initialize', { protocolVersion: '2025-03-26' });
    const daily = await mcp.request('tools/call', { name: 'get_daily_problem', arguments: {} });
    assert.equal(daily.result.isError, undefined);
    assert.match(text(daily), /Daily problem for 2026-10-14/);
    assert.match(text(daily), /# Two Sum \(lc-1\)/);
    assert.match(text(daily), /Difficulty: Easy/);
    assert.match(text(daily), /2 7 11 15/);
    assert.match(text(daily), /class Solution/);
    assert.ok(seen.every((r) => r.headers.authorization === `Bearer ${TOKEN}` && r.headers['x-locale'] === 'en'));

    const found = text(await mcp.request('tools/call', { name: 'search_problems', arguments: { query: 'sum', difficulty: 'easy' } }));
    assert.match(found, /lc-1: 1\. Two Sum \[Easy\]/);
    assert.doesNotMatch(found, /Company OA/);
    const library = seen.findLast((r) => r.url.pathname === '/api/oj/library').url.searchParams;
    assert.equal(library.get('collection'), 'all');
    assert.equal(library.get('difficulty'), '简单');
    const oa = text(await mcp.request('tools/call', { name: 'search_problems', arguments: { source: 'oa', company: 'acme' } }));
    assert.match(oa, /oa-acme-1: Acme #1 Widgets/);
    assert.equal(seen.findLast((r) => r.url.pathname === '/api/oj/oa-library').url.searchParams.get('ready'), '1');

    const run = await mcp.request('tools/call', {
      name: 'run_code',
      arguments: { problem_id: 'lc-1', language: 'python', code: 'print(1)' },
    });
    const posted = seen.findLast((r) => r.method === 'POST').body;
    assert.equal(posted.mode, 'run');
    assert.equal(posted.codingMode, 'acm');
    assert.match(posted.idempotencyKey, /^[a-zA-Z0-9_-]{16,100}$/);
    assert.equal('stdin' in posted, false);
    // Still running after the POST: the tool polls until the verdict.
    assert.match(text(run), /Submission sub-1: wrong answer/);
    assert.match(text(run), /stdout:\n```\n1 0/);
    polls = 0;
    await mcp.request('tools/call', {
      name: 'submit_code',
      arguments: { problem_id: 'lc-1', language: 'python', code: 'print(1)', coding_mode: 'leetcode' },
    });
    const submitted = seen.findLast((r) => r.method === 'POST').body;
    assert.equal(submitted.mode, 'judge');
    assert.equal(submitted.codingMode, 'leetcode');
    assert.notEqual(submitted.idempotencyKey, posted.idempotencyKey);
    polls = 5;
    assert.match(text(await mcp.request('tools/call', { name: 'get_submission', arguments: { submission_id: 'sub-1' } })), /passed 0\/1 · 12 ms · 9 MB/);
  } finally {
    mcp.stop();
  }
});

test('a missing or wrong token comes back as a tool error with setup help', async () => {
  const mcp = start({ CSWORK_TOKEN: '' });
  try {
    const reply = await mcp.request('tools/call', { name: 'get_problem', arguments: { problem_id: 'lc-1' } });
    assert.equal(reply.result.isError, true);
    assert.match(text(reply), /invalid or revoked.*CSWORK_TOKEN/);
  } finally {
    mcp.stop();
  }
});

test('the token never goes out over plain http to another host', async () => {
  const child = spawn(process.execPath, ['tools/mcp/cswork-mcp.mjs'], {
    env: { PATH: process.env.PATH, CSWORK_BASE_URL: 'http://cswork.example', CSWORK_TOKEN: TOKEN },
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 1);
  assert.match(stderr, /must use https/);
});
