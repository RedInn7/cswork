/**
 * Proves every resume project's acceptance script passes against its Python reference:
 * reference/server.py on a free port (run "http" or "tcp"), or reference/cli.py as CMD (run "cmd").
 * The script runs as `python3 -I -S`, so an import outside the standard library fails here.
 * One project at a time.
 *
 *   node scripts/projects/verify.mjs [slug ...]
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { resolve } from 'node:path';

const ROOT = resolve('content/projects');
const python = process.env.PYTHON || 'python3';
const wanted = process.argv.slice(2);
const slugs = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && (!wanted.length || wanted.includes(entry.name)))
  .map((entry) => entry.name);
if (wanted.length && slugs.length !== wanted.length) throw new Error(`unknown project in ${wanted.join(', ')}`);

const freePort = () =>
  new Promise((done, failed) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
    server.on('error', failed);
  });
const listening = (port) =>
  new Promise((done) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.destroy();
      done(true);
    });
    socket.on('error', () => done(false));
  });

let failed = 0;
for (const slug of slugs) {
  const dir = `${ROOT}/${slug}`;
  const { run } = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8'));
  const env = { ...process.env };
  let server = null;
  if (run === 'cmd') env.CMD = `${python} ${dir}/reference/cli.py`;
  else {
    const port = await freePort();
    server = spawn(python, [`${dir}/reference/server.py`], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    for (let i = 0; i < 100 && !(await listening(port)); i++) await new Promise((r) => setTimeout(r, 50));
    env.BASE_URL = `${run === 'tcp' ? 'tcp' : 'http'}://127.0.0.1:${port}`;
  }
  const started = Date.now();
  const result = spawnSync(python, ['-I', '-S', `${dir}/accept_test.py`], { env, encoding: 'utf8', timeout: 240_000 });
  server?.kill();
  const summary = result.stdout?.trim().split('\n').at(-1) ?? '';
  const ok = result.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${slug}: ${summary} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  if (!ok) {
    failed++;
    console.log(result.stdout, result.stderr, result.error ?? '');
  }
}
process.exit(failed ? 1 : 0);
