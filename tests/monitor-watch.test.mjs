import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Runs deploy/monitor/watch.sh against stubbed curl/df/openssl and records notifications.
const folder = mkdtempSync(join(tmpdir(), 'cswork-watch-'));
const bin = join(folder, 'bin'),
  state = join(folder, 'state'),
  log = join(folder, 'sent');
mkdirSync(bin);
mkdirSync(state);
after(() => rmSync(folder, { recursive: true, force: true }));
const stub = (name, body) => {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
};
stub('curl', '[[ $HEALTH == ok ]] && echo "{}" || { echo 503; exit 22; }');
stub('df', 'printf "Use%%\\n %s%%\\n" "$DISK"');
stub('timeout', 'exit 0');
stub('openssl', 'exit 0');
stub('cswork-notify', `echo "$*" >> ${JSON.stringify(log)}`);
const run = (DISK, HEALTH = 'ok') => {
  writeFileSync(log, '');
  execFileSync('bash', ['deploy/monitor/watch.sh'], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STATE_DIRECTORY: state, DISK, HEALTH },
  });
  return readFileSync(log, 'utf8').trim().replace(/ on .*/, '');
};

test('watch notifies once per problem per 6h, even when it flaps', () => {
  assert.match(run('86'), /^root disk 86% full/);
  assert.equal(run('85'), 'disk recovered');
  assert.equal(run('86'), '');
  assert.equal(run('85'), '');
  const old = Date.now() / 1000 - 7 * 3600;
  utimesSync(join(state, 'disk.sent'), old, old);
  assert.match(run('86'), /^root disk 86% full/);
  assert.equal(run('85'), 'disk recovered');
});

test('health alerts only after two consecutive failures', () => {
  assert.equal(run('10', 'down'), '');
  assert.equal(run('10', 'ok'), '');
  assert.equal(run('10', 'down'), '');
  assert.match(run('10', 'down'), /^cswork health failing/);
  assert.equal(run('10', 'ok'), 'health recovered');
});
