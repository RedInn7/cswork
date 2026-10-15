import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const compose = read('../deploy/oj/compose.yaml');
const scripts = {
  'oj-pandas-release.sh': read('../deploy/oj-pandas-release.sh'),
  'oj-capacity-release.sh': read('../deploy/oj-capacity-release.sh'),
};
const pandas = scripts['oj-pandas-release.sh'];

// compose.yaml's sandbox service, read with the few shapes it uses.
const sandbox = compose.slice(compose.indexOf('\n  sandbox:'), compose.indexOf('\n  redis:'));
const value = (key, indent = 4) => {
  const match = sandbox.match(new RegExp(`^ {${indent}}${key}: (.+)$`, 'm'));
  assert(match, `compose sandbox has no ${key}`);
  return match[1].replace(/^'(.*)'$/, '$1');
};
const flow = (key) => [...value(key).matchAll(/'([^']*)'|([^\s,[\]']+)/g)].map((m) => m[1] ?? m[2]);
// Lines of a nested block such as environment: or security_opt:.
const block = (key) => {
  const start = sandbox.indexOf(`\n    ${key}:\n`);
  assert(start > 0, `compose sandbox has no ${key} block`);
  const lines = [];
  for (const line of sandbox.slice(start + key.length + 7).split('\n')) {
    if (!line.startsWith('      ')) break;
    lines.push(line.trim());
  }
  return lines;
};
const shell = (v) => (v.includes('${') ? `"${v}"` : v);

function expectedFlags() {
  const project = compose.match(/^name: (\S+)$/m)[1];
  const env = block('environment').map((line) => line.match(/^(\w+): '?(.*?)'?$/).slice(1));
  const logOptions = [...value('options', 6).matchAll(/([\w-]+): '?([^,'}]+)'?/g)];
  return [
    `--name ${value('container_name')}`,
    `--restart ${value('restart')}`,
    `--cgroupns ${value('cgroup')}`,
    ...flow('cap_add').map((c) => `--cap-add ${c}`),
    ...flow('cap_drop').map((c) => `--cap-drop ${c}`),
    ...block('security_opt').map((o) => `--security-opt ${o.replace(/^- /, '')}`),
    ...flow('ports').map((p) => `-p ${p}`),
    // The token comes from GO_JUDGE_TOKEN in oj.env, exported by the script and passed by name only.
    ...env.map(([k, v]) => (k === 'ES_AUTH_TOKEN' ? '-e ES_AUTH_TOKEN' : `-e ${k}=${shell(v)}`)),
    `--memory ${value('mem_limit')}`,
    `--memory-swap ${value('memswap_limit')}`,
    `--cpus ${shell(value('cpus'))}`,
    `--cpu-shares ${value('cpu_shares')}`,
    `--pids-limit ${value('pids_limit')}`,
    `--shm-size ${value('shm_size')}`,
    ...flow('tmpfs').map((t) => `--tmpfs ${t}`),
    ...flow('networks').map((n) => `--network ${project}_${n}`),
    `--log-driver ${value('driver', 6)}`,
    ...logOptions.map(([, k, v]) => `--log-opt ${k}=${v}`),
    ...['interval', 'timeout', 'retries', 'start_period'].map((k) => `--health-${k.replace('_', '-')} ${value(k, 6)}`),
  ];
}

// The `docker run` that recreates cswork-oj-sandbox, split into flags, health command and image.
function sandboxRun(script) {
  const start = script.indexOf('docker run -d --name cswork-oj-sandbox');
  const end = script.indexOf('>/dev/null', start);
  assert(start > 0 && end > start);
  let text = script.slice(start + 'docker run -d'.length, end).replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
  const image = text.slice(text.lastIndexOf(' ') + 1);
  text = text.slice(0, text.lastIndexOf(' '));
  const h0 = text.indexOf('--health-cmd ');
  const h1 = text.indexOf(' --health-interval');
  const health = text.slice(h0 + '--health-cmd '.length, h1);
  return { image, health, flags: ` ${text.slice(0, h0)}${text.slice(h1 + 1)} ` };
}

test('both runner swap scripts start the sandbox exactly as compose.yaml declares', () => {
  const handled = ['build', 'image', 'container_name', 'restart', 'cgroup', 'cap_add', 'cap_drop', 'security_opt',
    'ports', 'environment', 'mem_limit', 'memswap_limit', 'cpus', 'cpu_shares', 'pids_limit', 'shm_size', 'tmpfs',
    'networks', 'healthcheck', 'logging'];
  // A new compose setting must be mapped here (and into both scripts) before it can ship.
  assert.deepEqual([...sandbox.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]).filter((k) => !handled.includes(k)), []);
  assert.match(value('ES_AUTH_TOKEN', 6), /^\$\{GO_JUDGE_TOKEN:\?/);
  const [, healthCode] = value('test', 6).match(/'-c', '(.+)'\]$/);
  for (const [name, script] of Object.entries(scripts)) {
    const run = sandboxRun(script);
    let rest = run.flags;
    for (const flag of expectedFlags()) {
      assert(rest.includes(` ${flag} `), `${name} is missing ${flag}`);
      rest = rest.replace(` ${flag} `, ' ');
    }
    // Docker-run-only extras: compose ownership labels and the service's network alias.
    rest = rest.replace(/ --label com\.docker\.compose\.[\w.-]+=\S+(?= )/g, '').replace(' --network-alias sandbox ', ' ');
    assert.equal(rest.trim(), '', `${name} has flags compose.yaml does not declare`);
    const health = run.health.replaceAll("'\\''", "'").slice(1, -1);
    assert.equal(health.replace(/\s/g, ''), `/usr/bin/python3-c'${healthCode}'`.replace(/\s/g, ''), name);
    const image = run.image === '"$image"' ? script.match(/^image=(\S+)$/m)[1] : run.image;
    assert.equal(image, value('image'), `${name} runs a different image than compose.yaml`);
    assert.match(script, /^export ES_AUTH_TOKEN="\$GO_JUDGE_TOKEN"$/m);
  }
  // The capacity release runs only on the verified pandas runner, not merely when the tag exists.
  assert.ok(
    scripts['oj-capacity-release.sh'].includes(`[[ $(docker inspect -f '{{.Image}}' cswork-oj-sandbox) == $(docker image inspect -f '{{.Id}}' ${value('image')}) ]] ||`),
    'oj-capacity-release.sh checks the running runner is the pandas image',
  );
});

test('a rollback ignores hangups and the queue is rechecked right before pausing', () => {
  for (const name of ['oj-pandas-release.sh', 'oj-capacity-release.sh']) {
    const finish = scripts[name].slice(scripts[name].indexOf('finish() {'));
    assert.match(finish, /^  trap - EXIT\n  #[^\n]*\n  trap '' HUP INT TERM$/m, name);
  }
  // After the build and smoke test, immediately before the handler and the pause.
  const beforeHandler = pandas.slice(0, pandas.indexOf('\nrunner_stopped=false\nrenamed=false'));
  assert.match(beforeHandler.split('\n').at(-1), /^queue status \|/);
  assert.ok(beforeHandler.lastIndexOf('docker build') < beforeHandler.lastIndexOf('queue status'));
});

test('pandas release never deletes a container or image', () => {
  const commands = pandas.split('\n').filter((line) => !/^\s*(echo|#)/.test(line)).join('\n');
  assert.doesNotMatch(commands, /docker\s+(rm|rmi|image\s+(rm|prune)|container\s+(rm|prune)|system\s+prune)\b/);
});

// Run the script's real EXIT handler with every external command stubbed.
function finish(state, waitStatus = 0) {
  const begin = pandas.indexOf('finish() {');
  const end = pandas.indexOf('\ntrap finish EXIT', begin);
  assert(begin > 0 && end > begin);
  // Stubs write to fd 3 so the handler's own >/dev/null redirections cannot hide them.
  return spawnSync('/bin/bash', ['-c', `
    exec 3>&1
    complete=false; paused=true; worker_touched=false; runner_stopped=false; renamed=false
    ${state}
    node=true; old_runner=OLD; failed_runner=FAILED; rollback=/backup
    systemctl() { echo "systemctl $*" >&3; }
    docker() { echo "docker $*" >&3; }
    cp() { echo "cp $*" >&3; }
    queue() { echo "queue $*" >&3; }
    wait_for_judge() { echo "wait_for_judge $2" >&3; return ${waitStatus}; }
    ${pandas.slice(begin, end)}
    false
    finish
  `], { encoding: 'utf8' });
}

test('failed queue drain only resumes the queue', () => {
  const result = finish('');
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout.trim(), 'queue resume');
});

test('failure after the swap restores runner, oj.env and compose before resuming', () => {
  const result = finish('worker_touched=true; runner_stopped=true; renamed=true');
  assert.equal(result.status, 1, result.stderr);
  const steps = [
    'systemctl stop cswork-oj-worker.service',
    'docker stop -t 5 cswork-oj-sandbox',
    'docker rename cswork-oj-sandbox FAILED',
    'docker rename OLD cswork-oj-sandbox',
    'docker start cswork-oj-sandbox',
    'cp -a /backup/oj.env /etc/cswork/oj.env',
    'cp -a /backup/compose.yaml /backup/verify-runtime.py /srv/cswork/oj/',
    'systemctl start cswork-oj-worker.service',
    'wait_for_judge 0',
    'queue resume',
  ];
  let at = -1;
  for (const step of steps) {
    const next = result.stdout.indexOf(step, at + 1);
    assert(next > at, `missing or out of order: ${step}\n${result.stdout}`);
    at = next;
  }
});

test('a rollback that never turns healthy keeps the queue paused', () => {
  const result = finish('worker_touched=true; runner_stopped=true; renamed=true', 1);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /queue resume/);
  assert.match(result.stdout, /rollback needs attention/);
});
