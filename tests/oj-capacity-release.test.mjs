import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('failed queue drain restores queue without touching running services', () => {
  const script = readFileSync(new URL('../deploy/oj-capacity-release.sh', import.meta.url), 'utf8');
  const begin = script.indexOf('finish() {');
  const end = script.indexOf('\ntrap finish EXIT', begin);
  assert(begin > 0 && end > begin);
  // Exercise the real EXIT handler; every external operation is replaced with a stub.
  const result = spawnSync('/bin/bash', ['-c', `
    complete=false; worker_touched=false; paused=true; renamed=false; runner_stopped=false; switched=false
    node=true; previous=unused; old_runner=unused; rollback=unused
    systemctl() { echo "UNEXPECTED systemctl $*"; }
    docker() { echo "UNEXPECTED docker $*"; }
    install() { echo "UNEXPECTED install $*"; }
    ln() { echo "UNEXPECTED ln $*"; }
    mv() { echo "UNEXPECTED mv $*"; }
    wait_for_judge() { echo 'UNEXPECTED health wait'; }
    queue() { echo "queue $*"; }
    ${script.slice(begin, end)}
    false
    finish
  `], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.doesNotMatch(result.stdout, /UNEXPECTED/);
  assert.match(result.stdout, /queue resume/);
  assert(script.indexOf('worker_touched=true') > script.lastIndexOf('queue pause'));
});
