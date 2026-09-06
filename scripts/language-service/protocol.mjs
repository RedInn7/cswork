import { timingSafeEqual } from 'node:crypto';

export const LANGUAGES = Object.freeze({
  python: {
    file: 'main.py',
    id: 'python',
    server: 'Pyright 1.1.411',
    memory: '768m',
  },
  go: {
    file: 'main.go',
    id: 'go',
    server: 'gopls 0.21.1 / Go 1.24.4',
    memory: '768m',
  },
  cpp: {
    file: 'main.cpp',
    id: 'cpp',
    server: 'clangd 19 / C++20',
    memory: '768m',
  },
  java: {
    file: 'Main.java',
    id: 'java',
    server: 'Eclipse JDT LS 1.55.0 / JDK 21',
    memory: '1536m',
  },
});
export const ACTIONS = Object.freeze({
  completion: 'textDocument/completion',
  hover: 'textDocument/hover',
  signature: 'textDocument/signatureHelp',
  diagnostics: null,
});
export class BrokerError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function authenticated(header, token) {
  const actual = Buffer.from(typeof header === 'string' ? header : '');
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function validateIdentity(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BrokerError(400, 'Expected an object');
  for (const key of ['ownerId', 'documentId']) {
    if (
      typeof body[key] !== 'string' ||
      !/^[A-Za-z0-9_.:@-]{1,160}$/.test(body[key])
    )
      throw new BrokerError(400, `Invalid ${key}`);
  }
  if (!Object.hasOwn(LANGUAGES, body.language))
    throw new BrokerError(400, 'Unsupported language');
  return [body.ownerId, body.documentId, body.language].join('/');
}
export function validateRequest(body) {
  const key = validateIdentity(body);
  if (!Object.hasOwn(ACTIONS, body.action))
    throw new BrokerError(400, 'Unsupported action');
  if (typeof body.code !== 'string' || Buffer.byteLength(body.code) > 65536)
    throw new BrokerError(413, 'Code exceeds 65536 bytes');
  if (!Number.isSafeInteger(body.version) || body.version < 1)
    throw new BrokerError(400, 'Invalid document version');
  if (body.action !== 'diagnostics') {
    const p = body.position;
    const lines = body.code.split('\n');
    if (
      !p ||
      !Number.isSafeInteger(p.line) ||
      !Number.isSafeInteger(p.character) ||
      p.line < 0 ||
      p.line >= lines.length ||
      p.character < 0 ||
      p.character > lines[p.line].replace(/\r$/, '').length
    )
      throw new BrokerError(400, 'Invalid UTF-16 position');
  }
  const allowed = new Set([
    'ownerId',
    'documentId',
    'language',
    'code',
    'version',
    'action',
    'position',
  ]);
  if (Object.keys(body).some((k) => !allowed.has(k)))
    throw new BrokerError(400, 'Unknown request field');
  return key;
}
export function dockerArguments(name, language, image) {
  if (!Object.hasOwn(LANGUAGES, language))
    throw new BrokerError(400, 'Unsupported language');
  return [
    'run',
    '--rm',
    '--interactive',
    '--init',
    '--name',
    name,
    '--label',
    'cswork.component=language-service',
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    '10001:10001',
    '--cpus',
    '1',
    '--memory',
    LANGUAGES[language].memory,
    '--memory-swap',
    LANGUAGES[language].memory,
    '--pids-limit',
    '128',
    '--ulimit',
    'nofile=256:256',
    '--ulimit',
    'core=0',
    '--log-driver',
    'none',
    '--tmpfs',
    '/workspace:rw,noexec,nosuid,nodev,size=268435456,uid=10001,gid=10001,mode=0700',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,nodev,size=268435456,uid=10001,gid=10001,mode=0700',
    image,
    language,
  ];
}

const completionFields = [
  'label',
  'labelDetails',
  'kind',
  'detail',
  'documentation',
  'sortText',
  'filterText',
  'insertText',
  'insertTextFormat',
  'insertTextMode',
  'textEdit',
  'textEditText',
  'additionalTextEdits',
  'commitCharacters',
  'deprecated',
  'tags',
  'preselect',
];
// Never forward server commands, opaque data, workspace edits, or arbitrary file URIs.
export function safeResult(action, result) {
  if (action === 'completion') {
    const items = Array.isArray(result) ? result : result?.items || [];
    const filtered = items
      .slice(0, 100)
      .map((item) =>
        Object.fromEntries(
          completionFields
            .filter((key) => item[key] !== undefined)
            .map((key) => [key, item[key]]),
        ),
      );
    return {
      isIncomplete: items.length > 100 || !!result?.isIncomplete,
      items: filtered,
      ...(result?.itemDefaults
        ? {
            itemDefaults: Object.fromEntries(
              [
                'commitCharacters',
                'editRange',
                'insertTextFormat',
                'insertTextMode',
              ]
                .filter((k) => result.itemDefaults[k] !== undefined)
                .map((k) => [k, result.itemDefaults[k]]),
            ),
          }
        : {}),
    };
  }
  if (action === 'hover')
    return result
      ? {
          contents: result.contents,
          ...(result.range ? { range: result.range } : {}),
        }
      : null;
  if (action === 'signature')
    return result
      ? {
          signatures: result.signatures?.slice(0, 20) || [],
          activeSignature: result.activeSignature,
          activeParameter: result.activeParameter,
        }
      : null;
  return null;
}
export function safeDiagnostics(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 100)
    .map((item) => ({
      range: item.range,
      severity: item.severity,
      code: item.code,
      source: item.source,
      message: String(item.message).slice(0, 8000),
      tags: item.tags,
    }));
}
