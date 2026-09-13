import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const entrypoint = readFileSync(new URL('../deploy/oj/entrypoint.sh', import.meta.url), 'utf8');
const compose = readFileSync(new URL('../deploy/oj/compose.yaml', import.meta.url), 'utf8');
const service = readFileSync(new URL('../deploy/cswork-oj-worker.service', import.meta.url), 'utf8');

test('runner capacity accepts bounded settings before touching cgroups', () => {
  // Exercise the real shell validation without performing privileged operations.
  const validation = entrypoint.split("# Docker's private cgroup namespace")[0];
  for (const value of [undefined, '1', '2', '4']) {
    const env = { PATH: process.env.PATH };
    if (value !== undefined) env.OJ_RUNNER_PARALLELISM = value;
    const result = spawnSync('/bin/sh', ['-c', `${validation}\nprintf '%s' "$OJ_RUNNER_PARALLELISM"`], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, value ?? '4');
  }
  for (const value of ['0', '3', '5', '100', '-1', '2; exit 0']) {
    const result = spawnSync('/bin/sh', ['-c', entrypoint], {
      env: { PATH: process.env.PATH, OJ_RUNNER_PARALLELISM: value }, encoding: 'utf8',
    });
    assert.equal(result.status, 64);
    assert.match(result.stderr, /must be 1, 2, or 4/);
  }
});

test('four runner slots have matched prefork, CPU budget and unchanged isolation', () => {
  assert.match(entrypoint, /-parallelism="\$OJ_RUNNER_PARALLELISM" -pre-fork="\$OJ_RUNNER_PARALLELISM"/);
  assert.match(compose, /OJ_RUNNER_PARALLELISM: '\$\{OJ_RUNNER_PARALLELISM:-4\}'/);
  assert.match(compose, /GOMAXPROCS: '\$\{OJ_RUNNER_GOMAXPROCS:-3\}'/);
  assert.match(compose, /cpus: '\$\{OJ_RUNNER_CPUS:-3\}'/);
  assert.match(compose, /cgroup: private/);
  assert.match(compose, /mem_limit: 4g\s+memswap_limit: 4g/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(entrypoint, /-net-share=false/);
  assert.match(service, /CPUQuota=100%\s+CPUWeight=50/);
});
