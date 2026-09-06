import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node.js';
import {
  ACTIONS,
  LANGUAGES,
  BrokerError,
  authenticated,
  dockerArguments,
  validateIdentity,
  validateRequest,
  safeResult,
  safeDiagnostics,
} from './protocol.mjs';

const exec = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SETTINGS = {
  python: {
    pythonPath: '/usr/bin/python3',
    analysis: {
      typeCheckingMode: 'basic',
      diagnosticMode: 'openFilesOnly',
      autoSearchPaths: false,
      useLibraryCodeForTypes: true,
      autoImportCompletions: true,
    },
  },
  gopls: {
    staticcheck: false,
    analyses: {},
    codelenses: {},
    completionBudget: '500ms',
    semanticTokens: false,
    telemetryPrompt: false,
  },
  java: {
    autobuild: { enabled: false },
    import: { maven: { enabled: false }, gradle: { enabled: false } },
    configuration: { updateBuildConfiguration: 'disabled' },
    references: { includeDecompiledSources: false },
    completion: { enabled: true },
    signatureHelp: { enabled: true },
    contentProvider: { preferred: null },
  },
};

export class LanguageSession {
  constructor(
    identity,
    { image = 'cswork-language-service:1', requestTimeoutMs = 45000 } = {},
  ) {
    this.ownerId = identity.ownerId;
    this.language = identity.language;
    this.id = randomUUID();
    this.name = `cswork-lsp-${this.id}`;
    this.uri = `file:///workspace/${LANGUAGES[this.language].file}`;
    this.version = 0;
    this.code = '';
    this.diagnostics = [];
    this.lastUsed = Date.now();
    this.createdAt = this.lastUsed;
    this.pending = 0;
    this.dead = false;
    this.tail = Promise.resolve();
    this.timeoutMs = requestTimeoutMs;
    const args = dockerArguments(
      this.name,
      this.language,
      image,
      identity.cppContext,
    );
    args[0] = 'create';
    this.creating = exec('docker', args, {
      timeout: 20000,
      maxBuffer: 4096,
      env: {
        PATH: process.env.PATH || '/usr/bin:/bin',
        DOCKER_HOST: 'unix:///var/run/docker.sock',
      },
    });
    this.ready = this.creating.then(() => {
      if (this.dead) throw new BrokerError(503, 'Language session closed');
      this.attach();
      return this.initialize();
    });
    // Attach a rejection handler immediately, even if the caller disconnects during startup.
    this.ready.catch(() => {
      void this.close().catch(() => {});
    });
  }

  attach() {
    this.child = spawn(
      'docker',
      ['start', '--attach', '--interactive', this.name],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: process.env.PATH || '/usr/bin:/bin',
          DOCKER_HOST: 'unix:///var/run/docker.sock',
        },
      },
    );
    // Bound lifetime output before the JSON-RPC reader. Source text is never logged.
    let bytes = 0;
    this.child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 32 * 1024 * 1024) void this.close().catch(() => {});
    });
    this.child.stderr.resume();
    this.connection = createMessageConnection(
      new StreamMessageReader(this.child.stdout),
      new StreamMessageWriter(this.child.stdin),
    );
    this.child.once('error', () => {
      void this.close().catch(() => {});
    });
    this.child.once('exit', () => {
      this.dead = true;
      this.connection.dispose();
    });
    this.connection.onRequest('workspace/configuration', (params) =>
      (params.items || []).map(
        ({ section }) =>
          (section || '')
            .split('.')
            .filter(Boolean)
            .reduce((value, key) => value?.[key], SETTINGS) || {},
      ),
    );
    this.connection.onRequest('client/registerCapability', () => null);
    this.connection.onRequest('client/unregisterCapability', () => null);
    this.connection.onRequest('window/workDoneProgress/create', () => null);
    this.connection.onRequest('workspace/workspaceFolders', () => [
      { uri: 'file:///workspace', name: 'cswork' },
    ]);
    this.connection.onRequest('workspace/applyEdit', () => ({
      applied: false,
      failureReason: 'Read-only language service',
    }));
    this.connection.onRequest('window/showMessageRequest', () => null);
    this.connection.onNotification(
      'textDocument/publishDiagnostics',
      (params) => {
        if (
          params.uri === this.uri &&
          (params.version === undefined || params.version === this.version)
        ) {
          this.diagnostics = safeDiagnostics(params.diagnostics);
          // A server omitting version cannot prove that a late notification belongs to this edit.
          // Do not label it as current: the editor must only apply version-matching markers.
          this.diagnosticsVersion = Number.isInteger(params.version)
            ? params.version
            : null;
        }
      },
    );
    this.connection.onError(() => {
      void this.close().catch(() => {});
    });
    this.connection.listen();
  }

  async timed(promise, milliseconds = this.timeoutMs) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new BrokerError(
                  504,
                  'Language service timed out; retry to start a fresh session',
                ),
              ),
            milliseconds,
          );
        }),
      ]);
    } catch (error) {
      await this.close();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async initialize() {
    const result = await this.timed(
      this.connection.sendRequest('initialize', {
        processId: null,
        clientInfo: { name: 'cswork', version: '1' },
        rootUri: 'file:///workspace',
        workspaceFolders: [{ uri: 'file:///workspace', name: 'cswork' }],
        capabilities: {
          general: { positionEncodings: ['utf-16'] },
          workspace: {
            configuration: true,
            workspaceFolders: true,
            applyEdit: false,
          },
          window: { workDoneProgress: true },
          textDocument: {
            synchronization: { dynamicRegistration: false, didSave: false },
            completion: {
              completionItem: {
                snippetSupport: true,
                documentationFormat: ['markdown', 'plaintext'],
                insertReplaceSupport: true,
                labelDetailsSupport: true,
              },
              contextSupport: true,
            },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            signatureHelp: {
              signatureInformation: {
                documentationFormat: ['markdown', 'plaintext'],
                parameterInformation: { labelOffsetSupport: true },
              },
            },
            publishDiagnostics: { versionSupport: true },
          },
        },
        initializationOptions:
          this.language === 'java'
            ? {
                settings: SETTINGS,
                extendedClientCapabilities: {
                  classFileContentsSupport: false,
                  executeClientCommandSupport: false,
                },
              }
            : this.language === 'go'
              ? SETTINGS.gopls
              : {},
      }),
      Math.max(1000, this.timeoutMs - (Date.now() - this.createdAt)),
    );
    this.capabilities = result?.capabilities || {};
    await this.connection.sendNotification('initialized', {});
    await this.connection.sendNotification('workspace/didChangeConfiguration', {
      settings: SETTINGS,
    });
  }

  run(body) {
    if (this.pending >= 8)
      return Promise.reject(
        new BrokerError(429, 'Too many pending language requests'),
      );
    this.pending++;
    this.lastUsed = Date.now();
    const task = this.tail.then(async () => {
      await this.ready;
      if (this.dead)
        throw new BrokerError(503, 'Language service stopped; retry');
      if (
        body.version < this.version ||
        (body.version === this.version && body.code !== this.code)
      )
        throw new BrokerError(409, 'Stale document version');
      if (body.version !== this.version) {
        const first = this.version === 0;
        this.version = body.version;
        this.code = body.code;
        this.diagnostics = [];
        this.diagnosticsVersion = null;
        await this.connection.sendNotification(
          first ? 'textDocument/didOpen' : 'textDocument/didChange',
          first
            ? {
                textDocument: {
                  uri: this.uri,
                  languageId: LANGUAGES[this.language].id,
                  version: this.version,
                  text: this.code,
                },
              }
            : {
                textDocument: { uri: this.uri, version: this.version },
                contentChanges: [{ text: this.code }],
              },
        );
      }
      let result = null;
      if (body.action === 'diagnostics') {
        // Diagnostics are asynchronous. The client can poll; never reuse markers from an older edit.
        for (
          let i = 0;
          i < 10 && this.diagnosticsVersion !== this.version && !this.dead;
          i++
        )
          await sleep(100);
      } else {
        result = await this.timed(
          this.connection.sendRequest(ACTIONS[body.action], {
            textDocument: { uri: this.uri },
            position: body.position,
            ...(body.action === 'completion'
              ? { context: { triggerKind: 1 } }
              : {}),
          }),
          15000,
        );
      }
      return {
        sessionId: this.id,
        version: this.version,
        language: this.language,
        result: safeResult(body.action, result),
        diagnostics: this.diagnostics,
        diagnosticsVersion: this.diagnosticsVersion,
        server: LANGUAGES[this.language].server,
      };
    });
    this.tail = task.catch(() => {});
    return task.finally(() => {
      this.pending--;
      this.lastUsed = Date.now();
    });
  }

  close() {
    if (this.closing) return this.closing;
    this.dead = true;
    this.connection?.dispose();
    this.child?.stdin.destroy();
    this.closing = (async () => {
      // Creation is awaited before removal: closing during cold start cannot leave an orphan.
      try {
        await this.creating;
      } catch {
        /* A failed create may still have created the named container. */
      }
      // The fixed generated name is the only docker argument derived from this session.
      // Keep the reservation until rm completes, so close/start cannot exceed the global cap.
      try {
        await exec('docker', ['rm', '--force', this.name], {
          timeout: 10000,
          maxBuffer: 4096,
        });
      } catch (error) {
        if (
          !String(error.stderr || '').includes(
            `No such container: ${this.name}`,
          )
        )
          throw new BrokerError(
            503,
            'Language session cleanup pending; retry shortly',
          );
      } finally {
        this.child?.kill('SIGKILL');
      }
    })().catch((error) => {
      this.closing = null;
      throw error;
    });
    return this.closing;
  }
}

export function createBroker({
  token,
  image = 'cswork-language-service:1',
  maxSessions = 4,
  maxPerOwner = 2,
  idleMs = 180000,
  lifetimeMs = 1800000,
  accepting = true,
  makeSession = (body) => new LanguageSession(body, { image }),
} = {}) {
  if (typeof token !== 'string' || token.length < 32)
    throw new Error('CSWORK_LSP_TOKEN must contain at least 32 characters');
  const sessions = new Map();
  const closedDocuments = new Map();
  async function remove(key, session) {
    await session.close();
    if (sessions.get(key) === session) sessions.delete(key);
  }
  async function reap() {
    const now = Date.now();
    for (const [key, expires] of closedDocuments)
      if (expires < now) closedDocuments.delete(key);
    // Failed removal retains its reservation and is retried, never overcommitting Docker.
    await Promise.allSettled(
      [...sessions]
        .filter(
          ([, session]) =>
            session.dead ||
            (!session.pending &&
              (now - session.lastUsed > idleMs ||
                now - session.createdAt > lifetimeMs)),
        )
        .map(([key, session]) => remove(key, session)),
    );
  }
  const timer = setInterval(
    () => {
      void reap();
    },
    Math.min(idleMs, 15000),
  );
  timer.unref();
  const server = http.createServer(async (req, res) => {
    function reply(status, body) {
      if (res.destroyed) return;
      let json = JSON.stringify(body);
      if (Buffer.byteLength(json) > 1024 * 1024) {
        status = 502;
        json = JSON.stringify({
          error: 'Language response exceeds size limit',
        });
      }
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(json);
    }
    try {
      if (!authenticated(req.headers.authorization, token)) {
        req.resume();
        reply(401, { error: 'Unauthorized' });
        return;
      }
      if (!accepting) {
        req.resume();
        reply(503, { error: 'Language service starting' });
        return;
      }
      if (req.method === 'GET' && req.url === '/health') {
        reply(200, {
          ok: true,
          sessions: sessions.size,
          maxSessions,
          servers: Object.fromEntries(
            Object.entries(LANGUAGES).map(([k, v]) => [k, v.server]),
          ),
        });
        return;
      }
      if (
        req.method !== 'POST' ||
        !['/v1/request', '/v1/close'].includes(req.url)
      ) {
        req.resume();
        reply(404, { error: 'Not found' });
        return;
      }
      if (!(req.headers['content-type'] || '').startsWith('application/json'))
        throw new BrokerError(415, 'Expected application/json');
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        // Drain rejected bodies without retaining them. Throwing inside the stream iterator
        // destroys IncomingMessage and resets keep-alive before a 413 can be delivered.
        if (size <= 512 * 1024) chunks.push(chunk);
      }
      if (size > 512 * 1024)
        throw new BrokerError(413, 'Request body exceeds size limit');
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new BrokerError(400, 'Invalid JSON');
      }
      if (req.url === '/v1/close') {
        const key = validateIdentity(body);
        closedDocuments.set(key, Date.now() + 180000);
        if (closedDocuments.size > 1024)
          closedDocuments.delete(closedDocuments.keys().next().value);
        if (sessions.has(key)) await remove(key, sessions.get(key));
        reply(200, { closed: true });
        return;
      }
      const key = validateRequest(body);
      await reap();
      if (closedDocuments.has(key))
        throw new BrokerError(
          409,
          'Document session closed; open a new editor document',
        );
      let session = sessions.get(key);
      if (session && session.cppContext !== body.cppContext) {
        if (session.pending)
          throw new BrokerError(409, 'C++ context update pending');
        await remove(key, session);
        session = sessions.get(key);
      }
      if (!session) {
        // No await between the capacity check and reservation.
        if (
          sessions.size >= maxSessions ||
          [...sessions.values()].filter((s) => s.ownerId === body.ownerId)
            .length >= maxPerOwner
        )
          throw new BrokerError(
            429,
            'Language service is busy; close another editor or retry shortly',
          );
        session = makeSession(body);
        session.cppContext = body.cppContext;
        sessions.set(key, session);
      }
      try {
        reply(200, await session.run(body));
      } catch (error) {
        if (session.dead) await remove(key, session);
        throw error;
      }
    } catch (error) {
      req.resume();
      reply(error instanceof BrokerError ? error.status : 503, {
        error:
          error instanceof BrokerError
            ? error.message
            : 'Language service unavailable; retry shortly',
      });
    }
  });
  server.requestTimeout = 65000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 64;
  return {
    server,
    sessions,
    reap,
    activate() {
      accepting = true;
    },
    async close() {
      accepting = false;
      clearInterval(timer);
      server.close();
      server.closeIdleConnections();
      await Promise.allSettled(
        [...sessions].map(([key, session]) => remove(key, session)),
      );
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const token = process.env.CSWORK_LSP_TOKEN;
  const image = process.env.CSWORK_LSP_IMAGE || 'cswork-language-service:1';
  if (!/^cswork-language-service:[A-Za-z0-9_.-]+$/.test(image))
    throw new Error('Invalid fixed language service image');
  const broker = createBroker({ token, image, accepting: false });
  const port = Number(process.env.CSWORK_LSP_PORT || 4321);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid port');
  // Claim the port before recovery. A duplicate broker must not delete the live broker's sessions.
  await new Promise((resolve, reject) => {
    broker.server.once('error', reject);
    broker.server.listen(port, '127.0.0.1', resolve);
  });
  try {
    const { stdout } = await exec(
      'docker',
      ['ps', '-aq', '--filter', 'label=cswork.component=language-service'],
      { timeout: 10000, maxBuffer: 65536 },
    );
    const ids = stdout
      .trim()
      .split(/\s+/)
      .filter((id) => /^[a-f0-9]{12,64}$/.test(id));
    if (ids.length)
      await exec('docker', ['rm', '--force', ...ids], {
        timeout: 20000,
        maxBuffer: 65536,
      });
    broker.activate();
    console.log(`cswork language broker listening on 127.0.0.1:${port}`);
  } catch (error) {
    await broker.close();
    throw error;
  }
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void broker.close().finally(() => process.exit(0));
    });
}
