#!/usr/bin/env node
// CSWork MCP server: practice cswork.org problems from Claude Code, Cursor or any MCP
// client. stdio transport (newline-delimited JSON-RPC 2.0), Node 18+ built-ins only.
// Setup and token: https://cswork.org/mcp
//   CSWORK_TOKEN     personal access token (cswork_pat_…) from the account page
//   CSWORK_LANG      en (default) or zh: statement and error language
//   CSWORK_BASE_URL  https://cswork.org by default; http only for localhost
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

const VERSION = '1.0.0';
// Newest first; a client asking for another version gets the newest.
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const ACTIVE = ['queued', 'compiling', 'running'];
const LANGUAGES = ['python', 'cpp', 'java', 'go'];
const TOKEN = (process.env.CSWORK_TOKEN || '').trim();
const ZH = process.env.CSWORK_LANG === 'zh';
const BASE = new URL(process.env.CSWORK_BASE_URL || 'https://cswork.org');
// The token must never cross the network in clear text.
if (BASE.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(BASE.hostname)) {
  process.stderr.write('cswork-mcp: CSWORK_BASE_URL must use https\n');
  process.exit(1);
}
const POLL_MS = Number(process.env.CSWORK_POLL_MS) || 1500;
const WAIT_MS = 30000;
const CLIP = 2000;

async function api(path, body) {
  const response = await fetch(new URL(`/api/${path}`, BASE), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      'X-Locale': ZH ? 'zh' : 'en',
      'User-Agent': `cswork-mcp/${VERSION}`,
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(WAIT_MS),
  }).catch((error) => {
    throw new Error(`Could not reach ${BASE.origin}: ${error.cause?.code || error.message}`);
  });
  const data = await response.json().catch(() => null);
  if (response.ok) return data;
  const message = data?.error || `HTTP ${response.status}`;
  throw new Error(
    response.status === 401
      ? `${message}. Create a token at ${BASE.origin}/?view=account and set CSWORK_TOKEN (see ${BASE.origin}/mcp).`
      : message,
  );
}

const clip = (text = '', max = CLIP) =>
  text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text;
const DIFFICULTY = { 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' };
const level = (d) => (ZH ? d : DIFFICULTY[d] || d);
const id = (value) => encodeURIComponent(value);

async function problemText(problemId, language = 'python') {
  const p = await api(`oj/problems/${id(problemId)}`);
  const en = !ZH && p.translations?.en;
  const statement = en || p;
  const source = p.sourceStatement
    ? ZH
      ? p.sourceStatement.descriptionZh || p.sourceStatement.descriptionEn
      : p.sourceStatement.descriptionEn || p.sourceStatement.descriptionZh
    : '';
  const template = p.leetcodeTemplates?.[language];
  const lines = [
    `# ${statement.title || p.title} (${p.id})`,
    `Difficulty: ${level(p.difficulty)} · Time limit: ${p.timeLimit} s · Memory: ${p.memoryLimit} MB · Languages: ${(p.languages || []).join(', ')}`,
    `Coding modes: ${(p.codingModes || ['acm']).join(', ')} · Page: ${BASE.origin}/?view=problem&problem=${id(p.id)}`,
    '',
    source || statement.description,
    '',
    '## Input (ACM mode: read stdin)',
    statement.input,
    '',
    '## Output (ACM mode: write stdout)',
    statement.output,
  ];
  for (const [index, sample] of (p.samples || []).entries())
    lines.push('', `## Example ${index + 1}`, 'Input:', '```', sample.input, '```', 'Output:', '```', sample.expectedOutput, '```');
  if (!source && statement.explanation) lines.push('', statement.explanation);
  if (template)
    lines.push(
      '',
      `## LeetCode mode template (${language}); submit with coding_mode "leetcode"`,
      '```' + language,
      template,
      '```',
    );
  if (p.leetcodeInputHelp) lines.push('', `Custom input in LeetCode mode: ${p.leetcodeInputHelp}`);
  return lines.join('\n');
}

async function settled(result) {
  const deadline = Date.now() + WAIT_MS;
  while (ACTIVE.includes(result.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    result = await api(`oj/submissions/${id(result.id)}`);
  }
  return result;
}

function verdictText(s) {
  const lines = [
    `Submission ${s.id}: ${String(s.status).replace(/_/g, ' ')}${ACTIVE.includes(s.status) ? ' (still judging; call get_submission later)' : ''}`,
    `${s.mode === 'run' ? 'Run' : 'Submit'} · ${s.language} · ${s.codingMode || 'acm'} mode · passed ${s.passed}/${s.total}` +
      (s.runtimeMs != null ? ` · ${Math.round(s.runtimeMs)} ms` : '') +
      (s.memoryKb != null ? ` · ${Math.round(s.memoryKb / 1024)} MB` : ''),
  ];
  if (s.message) lines.push(s.message);
  if (s.compileOutput) lines.push('', 'Compile output:', '```', clip(s.compileOutput), '```');
  for (const c of (s.cases || []).filter((c) => !c.hidden).slice(0, 10)) {
    lines.push('', `Case ${c.ordinal + 1}: ${c.status}${c.runtimeMs != null ? ` (${c.runtimeMs} ms)` : ''}`);
    for (const key of ['stdin', 'expected', 'stdout', 'stderr'])
      if (c[key]) lines.push(`${key}:`, '```', clip(c[key]), '```');
  }
  const hidden = (s.cases || []).filter((c) => c.hidden);
  if (hidden.length)
    lines.push('', `Hidden cases: ${hidden.filter((c) => c.status === 'accepted').length}/${hidden.length} accepted`);
  const f = s.firstFailure;
  if (f) {
    lines.push('', `First failing case (#${f.ordinal + 1}, ${f.status}):`);
    for (const key of ['stdin', 'expected', 'stdout', 'stderr'])
      if (f[key]) lines.push(`${key}:`, '```', clip(f[key]), '```');
  }
  return lines.join('\n');
}

const string = (description, extra = {}) => ({ type: 'string', description, ...extra });
const problemId = string('Problem id, e.g. lc-1 or oa-amazon-3 (from search_problems).', { maxLength: 80 });
const language = string('Programming language.', { enum: LANGUAGES });
const codingMode = string('acm reads stdin and writes stdout; leetcode implements the template (problems that offer it).', {
  enum: ['acm', 'leetcode'],
});
const code = string('Complete source code (at most 64 KiB).', { maxLength: 65536 });
const object = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const READ = { readOnlyHint: true, openWorldHint: true };
const JUDGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

const TOOLS = [
  {
    name: 'get_daily_problem',
    title: 'Daily problem',
    description: "Today's CSWork daily problem (Beijing date) with its full statement and examples.",
    inputSchema: object({ language: { ...language, description: 'Language for the LeetCode-mode template (default python).' } }),
    annotations: READ,
    async run({ language }) {
      const { daily } = await api('oj/daily');
      if (!daily) return 'No daily problem today.';
      const company = daily.company ? ` · ${daily.company.name} OA` : '';
      return `Daily problem for ${daily.date}${company}\n\n${await problemText(daily.id, language)}`;
    },
  },
  {
    name: 'search_problems',
    title: 'Search problems',
    description:
      'Search judgeable CSWork problems: the LeetCode-numbered bank and company online assessments (OA). Returns ids for get_problem.',
    inputSchema: object({
      query: string('Title, number or keyword; empty lists everything.', { maxLength: 180 }),
      source: string('Which bank to search (default all).', { enum: ['all', 'leetcode', 'oa'] }),
      company: string('OA company slug, e.g. amazon (OA only).', { maxLength: 160 }),
      difficulty: string('LeetCode bank only.', { enum: ['easy', 'medium', 'hard'] }),
      page: { type: 'integer', minimum: 1, maximum: 1000, description: 'Page of 30 results (default 1).' },
    }),
    annotations: READ,
    async run({ query = '', source = 'all', company = '', difficulty = '', page = 1 }) {
      const out = [];
      if (source !== 'oa' && !company) {
        const params = new URLSearchParams({ collection: 'all', q: query, page: String(page) });
        if (difficulty) params.set('difficulty', { easy: '简单', medium: '中等', hard: '困难' }[difficulty]);
        const list = await api(`oj/library?${params}`);
        out.push(`## LeetCode bank: ${list.total} matches (page ${list.page})`);
        for (const item of list.items)
          out.push(
            `- ${item.judgeProblemId || item.id}: ${item.number}. ${ZH ? item.titleZh : item.titleEn || item.titleZh} [${level(item.difficulty)}]` +
              (item.topics?.length ? ` · ${item.topics.slice(0, 3).join(', ')}` : '') +
              (item.judgeProblemId ? '' : ' (not judgeable yet)'),
          );
      }
      if (source !== 'leetcode' && !difficulty) {
        const params = new URLSearchParams({ ready: '1', q: query, page: String(page) });
        if (company) params.set('company', company);
        const list = await api(`oj/oa-library?${params}`);
        out.push(`## Company OA: ${list.total} judgeable matches (page ${list.page})`);
        for (const item of list.items)
          out.push(
            `- ${item.judgeProblemId || item.id}: ${item.companyName} #${item.number} ${item.title}` +
              (item.topics?.length ? ` · ${item.topics.slice(0, 3).join(', ')}` : ''),
          );
      }
      return out.join('\n') || 'Nothing to search: difficulty filters the LeetCode bank and company the OAs.';
    },
  },
  {
    name: 'get_problem',
    title: 'Get problem',
    description: 'Full statement, limits, examples and the LeetCode-mode template of one problem.',
    inputSchema: object({ problem_id: problemId, language: { ...language, description: 'Template language (default python).' } }, ['problem_id']),
    annotations: READ,
    run: ({ problem_id, language }) => problemText(problem_id, language),
  },
  {
    name: 'run_code',
    title: 'Run code',
    description:
      'Run code on the public examples, or on custom stdin. Not a formal submission: it does not count toward progress.',
    inputSchema: object(
      {
        problem_id: problemId,
        language,
        code,
        coding_mode: codingMode,
        stdin: string('Optional custom input instead of the examples (at most 64 KiB).', { maxLength: 65536 }),
      },
      ['problem_id', 'language', 'code'],
    ),
    annotations: JUDGE,
    async run({ problem_id, language, code, coding_mode = 'acm', stdin }) {
      const body = { problemId: problem_id, language, code, mode: 'run', codingMode: coding_mode, idempotencyKey: randomUUID() };
      return verdictText(await settled(await api('oj/submissions', stdin === undefined ? body : { ...body, stdin })));
    },
  },
  {
    name: 'submit_code',
    title: 'Submit code',
    description: 'Formally submit code against all test cases, hidden ones included. Counts toward progress and streaks.',
    inputSchema: object({ problem_id: problemId, language, code, coding_mode: codingMode }, ['problem_id', 'language', 'code']),
    annotations: JUDGE,
    async run({ problem_id, language, code, coding_mode = 'acm' }) {
      const body = { problemId: problem_id, language, code, mode: 'judge', codingMode: coding_mode, idempotencyKey: randomUUID() };
      return verdictText(await settled(await api('oj/submissions', body)));
    },
  },
  {
    name: 'get_submission',
    title: 'Get submission',
    description: 'Verdict and per-case results of a run or submission, waiting up to 30 s while it is still judging.',
    inputSchema: object({ submission_id: string('Submission id from run_code or submit_code.', { maxLength: 100 }) }, ['submission_id']),
    annotations: READ,
    run: async ({ submission_id }) => verdictText(await settled(await api(`oj/submissions/${id(submission_id)}`))),
  },
];

/** The argument problems of `args` against a tool's inputSchema, or null when it fits. */
function invalid(schema, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return 'arguments must be an object';
  for (const key of schema.required) if (args[key] === undefined) return `missing ${key}`;
  for (const [key, value] of Object.entries(args)) {
    const rule = schema.properties[key];
    if (!rule) return `unknown argument ${key}`;
    if (rule.type === 'integer' ? !Number.isInteger(value) || value < rule.minimum || value > rule.maximum : typeof value !== 'string')
      return `${key} must be ${rule.type === 'integer' ? `an integer ${rule.minimum}–${rule.maximum}` : 'a string'}`;
    if (rule.enum && !rule.enum.includes(value)) return `${key} must be one of ${rule.enum.join(', ')}`;
    if (rule.maxLength && value.length > rule.maxLength) return `${key} is longer than ${rule.maxLength}`;
  }
  return null;
}

async function answer(method, params = {}) {
  if (method === 'initialize')
    return {
      protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'cswork', title: 'CSWork', version: VERSION },
      instructions:
        'Practice CSWork algorithm and company OA problems: search_problems or get_daily_problem, read it with get_problem, try code with run_code, then submit_code. Let the learner write the solution unless they ask for one.',
    };
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: TOOLS.map(({ run, ...tool }) => tool) };
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) throw Object.assign(new Error(`Unknown tool: ${params.name}`), { code: -32602 });
    const args = params.arguments ?? {};
    const problem = invalid(tool.inputSchema, args);
    if (problem) throw Object.assign(new Error(`Invalid arguments: ${problem}`), { code: -32602 });
    try {
      return { content: [{ type: 'text', text: await tool.run(args) }] };
    } catch (error) {
      // Tool failures are results the model can read and act on, not protocol errors.
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
  throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
}

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', async (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return send({ id: null, error: { code: -32700, message: 'Parse error' } });
  }
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.method !== 'string')
    return send({ id: message?.id ?? null, error: { code: -32600, message: 'Invalid Request' } });
  const hasId = Object.hasOwn(message, 'id');
  try {
    const result = await answer(message.method, message.params);
    // Notifications (no id), such as notifications/initialized, get no reply.
    if (hasId) send({ id: message.id, result });
  } catch (error) {
    if (hasId) send({ id: message.id, error: { code: error.code ?? -32603, message: error.message } });
  }
});
