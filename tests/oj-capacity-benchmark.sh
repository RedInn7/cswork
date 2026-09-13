#!/bin/bash
# Dedicated test runner only. Run as root on the judge host.
set -euo pipefail
probe_dir=${TEST_PROBE_DIR:?Set TEST_PROBE_DIR to copied test scripts with runtime dependencies}
label=${TEST_CAPACITY_LABEL:-baseline}
[[ "$label" =~ ^[a-zA-Z0-9_-]+$ ]]
test_runner=cswork-oj-capacity-test
set -a
source /etc/cswork/oj.env
set +a
export ES_AUTH_TOKEN="$GO_JUDGE_TOKEN"
extra=()
if [[ -n "${TEST_RUNNER_ENTRYPOINT:-}" ]]; then
  extra=(-v "$TEST_RUNNER_ENTRYPOINT:/opt/capacity-entrypoint.sh:ro" --entrypoint /bin/sh)
fi
cleanup() { docker stop -t 10 "$test_runner" >/dev/null 2>&1 || true; }
docker inspect "$test_runner" >/dev/null 2>&1 && { echo 'Test runner already exists; refusing to replace it'; exit 1; }
trap cleanup EXIT
docker run -d --rm --name "$test_runner" --cgroupns private --cap-add SYS_ADMIN --cap-drop NET_RAW --security-opt apparmor=unconfined --security-opt systempaths=unconfined --security-opt no-new-privileges:true --security-opt seccomp=/srv/cswork/oj/docker-seccomp.json -p 127.0.0.1:5053:5050 -e ES_AUTH_TOKEN -e GOMAXPROCS="${TEST_RUNNER_GOMAXPROCS:-2}" -e OJ_RUNNER_PARALLELISM="${TEST_RUNNER_PARALLELISM:-2}" -e GOMEMLIMIT=512MiB --memory 4g --memory-swap 4g --cpus "${TEST_RUNNER_CPUS:-2}" --pids-limit 512 --shm-size 512m --tmpfs /tmp:rw,nosuid,nodev,size=768m "${extra[@]}" sha256:f712f598dade4768a4fd638a64d985dd94f18cda285bee75610ec92bd23ff7a7 ${TEST_RUNNER_ENTRYPOINT:+/opt/capacity-entrypoint.sh} >/dev/null
for attempt in {1..20}; do
  if docker exec "$test_runner" /usr/bin/python3 -c 'import os,urllib.request;urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5050/version",headers={"Authorization":"Bearer "+os.environ["ES_AUTH_TOKEN"]}),timeout=2).close()' 2>/dev/null; then break; fi
  sleep 1
done
runner_pid=$(docker inspect -f '{{.State.Pid}}' "$test_runner")
cgroup=$(awk -F: '$1=="0" {print $3}' "/proc/$runner_pid/cgroup")
# go-judge moves its API into a child group; jobs are sibling groups. Sample
# the Docker scope, not API-only CPU, to include compiler and judged programs.
cgroup=${cgroup%%.scope/*}.scope
export TEST_RUNNER_CPU_STAT="/sys/fs/cgroup$cgroup/cpu.stat"
export SOURCE_DATABASE_PATH=/var/lib/cswork/cswork.sqlite
export TEST_WORKER_ENTRY=${TEST_WORKER_ENTRY:-/srv/cswork/current/oj-worker/index.mjs}
export GO_JUDGE_URL=http://127.0.0.1:5053
export TEST_HARNESS_VERSION=72dae7cbed456138acbbb95725e246cd6bdc58bfc5f815da66e9f85fb9ea1624
export TEST_ROUNDS=${TEST_ROUNDS:-1} TEST_LANGUAGES=${TEST_LANGUAGES:-cpp,java} TEST_CONCURRENCY=${TEST_CONCURRENCY:-1,10} TEST_GROUPS=${TEST_GROUPS:-cold,warm}
export TEST_CAPACITY_LABEL="$label" TEST_WEB_URL=http://127.0.0.1:4317/
export NODE_OPTIONS=--max-old-space-size=768
cd /srv/cswork/current
/opt/cswork/runtime/node "$probe_dir/oj-capacity-benchmark.mjs"
