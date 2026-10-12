#!/usr/bin/env bash
# A/B for per-submission case parallelism: one submission's 28 cases with 2 vs 4
# sandboxes in flight, on a throwaway go-judge with production's limits (4 CPUs,
# 4 slots, 6 GiB, lower CPU weight than the web). Never touches the production
# runner, database or credentials; the container and its random token are removed on exit.
# Usage from the repo root: ssh ubuntu@192.18.137.70 'bash -s' < tests/oj-case-parallel-bench.sh
set -euo pipefail
name=cswork-case-parallel-bench port=5057
docker inspect "$name" >/dev/null 2>&1 && { echo "$name already exists; refusing to replace it"; exit 1; }
script=$(mktemp /tmp/oj-case-parallel-bench.XXXXXX.mjs)
cleanup() { docker stop -t 5 "$name" >/dev/null 2>&1 || true; rm -f "$script"; }
trap cleanup EXIT
ES_AUTH_TOKEN=$(openssl rand -hex 24) && export ES_AUTH_TOKEN
docker run -d --rm --name "$name" --cgroupns private --cap-add SYS_ADMIN --cap-drop NET_RAW \
  --security-opt apparmor=unconfined --security-opt systempaths=unconfined --security-opt no-new-privileges:true \
  --security-opt seccomp=/srv/cswork/oj/docker-seccomp.json -p "127.0.0.1:$port:5050" \
  -e ES_AUTH_TOKEN -e GOMAXPROCS=3 -e OJ_RUNNER_PARALLELISM=4 -e GOMEMLIMIT=512MiB \
  --memory 6g --memory-swap 6g --cpus 4 --cpu-shares 512 --pids-limit 512 --shm-size 512m \
  --tmpfs /tmp:rw,nosuid,nodev,size=768m cswork-go-judge:1.12.3-seccomp-capacity4 >/dev/null
for _ in $(seq 1 30); do
  curl -sf -H "Authorization: Bearer $ES_AUTH_TOKEN" "http://127.0.0.1:$port/version" >/dev/null && break
  sleep 1
done
cat >"$script" <<'JS'
// A/B: run one submission's 28 cases with 2 vs 4 sandboxes in flight against an
// isolated go-judge identical to production. Mirrors lib/server/oj-engine.ts requests.
const URL_ = process.env.GO_JUDGE_URL, TOKEN = process.env.GO_JUDGE_TOKEN;
const ROUNDS = Number(process.env.ROUNDS || 7), CASES = 28;
const env = ['PATH=/usr/bin:/bin', 'HOME=/w', 'LANG=C.UTF-8', 'TZ=UTC'];
async function exec(cmd) {
  const r = await fetch(URL_ + '/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ cmd: [cmd] }),
  });
  if (!r.ok) throw new Error('runner ' + r.status);
  return (await r.json())[0];
}
const lim = (input, cpu, clock, mem, out) => ({
  env,
  files: [{ content: input }, { name: 'stdout', max: out, pipe: true }, { name: 'stderr', max: 65536, pipe: true }],
  cpuLimit: cpu * 1e9, clockLimit: clock * 1e9, memoryLimit: mem, procLimit: 64,
});
const src = {
  cpp: ['main.cpp', '#include <bits/stdc++.h>\nint main(){long long n,s=0,x;std::cin>>n;std::vector<long long>v(n);for(auto&a:v){std::cin>>a;s+=a;}std::sort(v.begin(),v.end());std::cout<<s<<"\\n";}'],
  java: ['Main.java', 'import java.util.*;public class Main{public static void main(String[] a){Scanner in=new Scanner(System.in);int n=in.nextInt();long s=0;long[] v=new long[n];for(int i=0;i<n;i++){v[i]=in.nextLong();s+=v[i];}Arrays.sort(v);System.out.println(s);}}'],
  python: ['main.py', 'import sys\nd=sys.stdin.read().split()\nv=sorted(map(int,d[1:]))\nprint(sum(v))\n'],
};
const compileArgs = {
  cpp: ['/usr/bin/g++', '-std=c++20', '-O2', '-pipe', 'main.cpp', '-o', 'main'],
  java: ['/bin/sh', '-c', '/usr/bin/javac -encoding UTF-8 Main.java && /usr/bin/jar cf main.jar *.class'],
};
const memLimitKb = 256 * 1024, heap = Math.max(8, Math.floor((memLimitKb / 1024) * 0.6));
const runArgs = {
  cpp: ['main'],
  java: ['/usr/bin/java', `-Xmx${heap}m`, '-Xss256k', '-XX:ReservedCodeCacheSize=32m', '-XX:MaxMetaspaceSize=64m', '-XX:ActiveProcessorCount=1', '-cp', 'main.jar', 'Main'],
  python: ['/usr/bin/python3', '-I', 'main.py'],
};
const inputs = Array.from({ length: CASES }, (_, k) => {
  const n = 2000 + k * 50;
  return n + '\n' + Array.from({ length: n }, (_, i) => ((i * 7919 + k) % 100003) - 50000).join(' ') + '\n';
});
async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) await fn(items[next++]); }));
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const lang of (process.env.LANGS || 'cpp,python,java').split(',')) {
  const [name, code] = src[lang];
  let copyIn = { [name]: { content: code } }, fileIds = {};
  if (compileArgs[lang]) {
    const out = lang === 'java' ? 'main.jar' : 'main';
    const c = await exec({ ...lim('', 30, 60, 1 << 30, 65536), args: compileArgs[lang], env: [...env, 'GOMAXPROCS=2'], copyIn, copyOutCached: [out], copyOutMax: 16777216 });
    if (c.status !== 'Accepted') throw new Error(lang + ' compile ' + JSON.stringify(c).slice(0, 400));
    fileIds = c.fileIds;
    copyIn = { [out]: { fileId: fileIds[out] } };
  }
  const runCase = async (input) => {
    const r = await exec({ ...lim(input, 2, 6, memLimitKb * 1024, 8 << 20), args: runArgs[lang], copyIn });
    if (r.status !== 'Accepted') throw new Error(lang + ' run ' + r.status + ' ' + (r.files?.stderr || '').slice(0, 300));
  };
  await pool(inputs.slice(0, 4), 4, runCase); // warm the page cache and runner
  const times = { 2: [], 4: [] };
  for (let round = 0; round < ROUNDS; round++)
    for (const size of round % 2 ? [4, 2] : [2, 4]) {
      const t = performance.now();
      await pool(inputs, size, runCase);
      times[size].push(performance.now() - t);
    }
  const fmt = (a) => `median ${median(a).toFixed(0)}ms (min ${Math.min(...a).toFixed(0)}, max ${Math.max(...a).toFixed(0)})`;
  console.log(`${lang}: 28 cases  x2 ${fmt(times[2])}  |  x4 ${fmt(times[4])}  |  saved ${(median(times[2]) - median(times[4])).toFixed(0)}ms`);
  for (const id of Object.values(fileIds)) await fetch(`${URL_}/file/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
}
JS
uptime
GO_JUDGE_URL="http://127.0.0.1:$port" GO_JUDGE_TOKEN="$ES_AUTH_TOKEN" /opt/cswork/runtime/node "$script"
