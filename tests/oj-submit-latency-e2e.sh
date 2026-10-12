#!/usr/bin/env bash
# Server wrapper for tests/oj-submit-latency-e2e.mjs: a throwaway go-judge with
# production's limits on 5053 and a throwaway Redis, both removed on exit, so
# the probe never touches the production runner, queue, database or credentials.
# Usage on the server, from a directory holding tests/ and drizzle/ of the same commit:
#   bash tests/oj-submit-latency-e2e.sh /srv/cswork/current baseline
set -euo pipefail
release=$(realpath -e "${1:?release dir with server.js and oj-worker/}")
label=${2:-$(cat "$release/REVISION" 2>/dev/null || echo candidate)}
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
runner=cswork-latency-runner redis=cswork-latency-redis
for c in $runner $redis; do docker inspect "$c" >/dev/null 2>&1 && { echo "$c exists; refusing"; exit 1; }; done
cleanup() { docker stop -t 5 $runner $redis >/dev/null 2>&1 || true; }
trap cleanup EXIT
ES_AUTH_TOKEN=$(openssl rand -hex 24) && export ES_AUTH_TOKEN
docker run -d --rm --name $runner --cgroupns private --cap-add SYS_ADMIN --cap-drop NET_RAW \
  --security-opt apparmor=unconfined --security-opt systempaths=unconfined --security-opt no-new-privileges:true \
  --security-opt seccomp=/srv/cswork/oj/docker-seccomp.json -p 127.0.0.1:5053:5050 \
  -e ES_AUTH_TOKEN -e GOMAXPROCS=3 -e OJ_RUNNER_PARALLELISM=4 -e GOMEMLIMIT=512MiB \
  --memory 6g --memory-swap 6g --cpus 4 --cpu-shares 512 --pids-limit 512 --shm-size 512m \
  --tmpfs /tmp:rw,nosuid,nodev,size=768m cswork-go-judge:1.12.3-seccomp-capacity4 >/dev/null
docker run -d --rm --name $redis -p 127.0.0.1:6391:6379 \
  redis:8.2-alpine@sha256:30abb90e62f14b737010746def3ba99cc79fe19dcdb3d37b41f21fc62e7da19d \
  redis-server --save '' --appendonly no >/dev/null
for _ in $(seq 1 30); do
  curl -sf -H "Authorization: Bearer $ES_AUTH_TOKEN" http://127.0.0.1:5053/version >/dev/null && break
  sleep 1
done
TEST_ARTIFACT_DIR=$release TEST_MIGRATIONS_DIR=$here/drizzle TEST_LABEL=$label \
  GO_JUDGE_URL=http://127.0.0.1:5053 GO_JUDGE_TOKEN=$ES_AUTH_TOKEN REDIS_URL=redis://127.0.0.1:6391 \
  /opt/cswork/runtime/node "$here/tests/oj-submit-latency-e2e.mjs"
