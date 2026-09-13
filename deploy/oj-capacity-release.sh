#!/usr/bin/env bash
# Worker-only overlay release. No schema, web bundle, credentials or user data changes.
# Only use when the reviewed diff from base contains worker/deployment/tests/docs changes.
set -euo pipefail
release=${1:?Candidate commit SHA}
base=${2:?Exact deployed base SHA}
bundle=${3:?Tested worker bundle absolute path}
[[ $EUID -eq 0 && "$release" =~ ^[a-f0-9]{40}$ && "$base" =~ ^[a-f0-9]{40}$ && "$bundle" = /* ]] || exit 2
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node=/opt/cswork/runtime/node
previous=$(readlink -f /srv/cswork/current)
[[ "$previous" == "/srv/cswork/releases/$base" ]] || { echo 'Base release changed; aborting'; exit 1; }
[[ $(cat "$previous/REVISION") == "$base" ]] || exit 1
test -s "$bundle"
target="/srv/cswork/releases/$release"
test ! -e "$target"
old_runner="cswork-oj-sandbox-rollback-${release:0:12}"
! docker inspect "$old_runner" >/dev/null 2>&1
docker image inspect cswork-go-judge:1.12.3-seccomp-capacity4 >/dev/null
test "$(docker inspect -f '{{.State.Running}}' cswork-oj-sandbox)" = true
test "$(df --output=avail -B1 /srv/cswork | tail -1)" -gt 1073741824
# Separate copy, not hardlinks: replacing the worker cannot alter the rollback release.
cp -a "$previous" "$target"
install -m 644 "$bundle" "$target/oj-worker/index.mjs"
printf '%s\n' "$release" > "$target/REVISION"
printf 'oj-worker-overlay\nbase=%s\n' "$base" > "$target/RELEASE_KIND"
rollback="$target/capacity-rollback"
install -d -m 700 "$rollback"
cp -a /etc/systemd/system/cswork-oj-worker.service "$rollback/worker.service"
cp -a /srv/cswork/oj/compose.yaml "$rollback/compose.yaml"
queue() { "$node" --env-file=/etc/cswork/cswork.env --env-file=/etc/cswork/oj.env "$source_dir/deploy/oj-queue-control.cjs" "$1"; }
wait_for_judge() {
  local started=$1
  for attempt in {1..30}; do
    if [[ $(docker inspect -f '{{.State.Health.Status}}' cswork-oj-sandbox) == healthy ]] &&
      systemctl is-active --quiet cswork-oj-worker.service &&
      STARTED="$started" "$node" --env-file=/etc/cswork/cswork.env --input-type=module -e '
        import {createRequire} from "node:module";
        const Database=createRequire("/srv/cswork/current/package.json")("better-sqlite3");
        const db=new Database(process.env.DATABASE_PATH,{readonly:true});
        const row=db.prepare("SELECT healthy,heartbeat_at FROM oj_runtime WHERE id=?").get("worker");db.close();
        process.exit(row?.healthy && row.heartbeat_at>=Number(process.env.STARTED) && Date.now()-row.heartbeat_at<15000 ? 0 : 1);'; then return 0; fi
    sleep 1
  done
  return 1
}
queue status | "$node" -e 'let text="";process.stdin.on("data",v=>text+=v);process.stdin.on("end",()=>{if(JSON.parse(text).paused){console.error("Queue is already paused; preserve maintenance and abort");process.exit(1)}})'
paused=false
renamed=false
runner_stopped=false
switched=false
complete=false
finish() {
  code=$?
  trap - EXIT
  set +e
  recovery_failed=false
  if [[ "$complete" != true ]]; then
    systemctl stop cswork-oj-worker.service || recovery_failed=true
    if [[ "$renamed" == true ]]; then
      docker rm -f cswork-oj-sandbox >/dev/null 2>&1 || true
      docker rename "$old_runner" cswork-oj-sandbox || recovery_failed=true
      docker start cswork-oj-sandbox >/dev/null || recovery_failed=true
    elif [[ "$runner_stopped" == true ]]; then
      docker start cswork-oj-sandbox >/dev/null || recovery_failed=true
    fi
    if [[ "$switched" == true ]]; then
      ln -s "$previous" /srv/cswork/current.capacity-rollback &&
        mv -Tf /srv/cswork/current.capacity-rollback /srv/cswork/current || recovery_failed=true
    fi
    install -m 644 "$rollback/worker.service" /etc/systemd/system/cswork-oj-worker.service || recovery_failed=true
    install -m 644 "$rollback/compose.yaml" /srv/cswork/oj/compose.yaml || recovery_failed=true
    systemctl daemon-reload || recovery_failed=true
    recovery_started=$("$node" -p 'Date.now()')
    systemctl start cswork-oj-worker.service || recovery_failed=true
    wait_for_judge "$recovery_started" || recovery_failed=true
    if [[ "$recovery_failed" != true ]]; then echo 'Previous judge configuration restored.'; fi
  fi
  if [[ "$recovery_failed" == true ]]; then
    echo "ERROR: rollback needs attention. Queue remains paused; previous=$previous runner=$old_runner"
    exit 1
  fi
  if [[ "$paused" == true ]]; then queue resume || { echo 'ERROR: judge is ready but queue resume failed'; exit 1; }; fi
  exit "$code"
}
trap finish EXIT
paused=true
queue pause
systemctl stop cswork-oj-worker.service
runner_stopped=true
docker stop -t 20 cswork-oj-sandbox >/dev/null
docker rename cswork-oj-sandbox "$old_runner"
renamed=true
set -a
source /etc/cswork/oj.env
set +a
export ES_AUTH_TOKEN="$GO_JUDGE_TOKEN"
# Same security, network and resource settings as the reviewed compose service.
docker run -d --name cswork-oj-sandbox --restart unless-stopped \
  --network cswork-oj_judge --network-alias sandbox \
  --cgroupns private --cap-add SYS_ADMIN --cap-drop NET_RAW \
  --security-opt apparmor=unconfined --security-opt systempaths=unconfined \
  --security-opt no-new-privileges:true --security-opt seccomp=/srv/cswork/oj/docker-seccomp.json \
  -p 127.0.0.1:5050:5050 -e ES_AUTH_TOKEN -e GOMAXPROCS=3 -e GOMEMLIMIT=512MiB \
  -e OJ_RUNNER_PARALLELISM=4 --memory 4g --memory-swap 4g --cpus 3 \
  --pids-limit 512 --shm-size 512m --tmpfs /tmp:rw,nosuid,nodev,size=768m \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  --health-cmd '/usr/bin/python3 -c '\''import os,urllib.request;urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5050/version",headers={"Authorization":"Bearer "+os.environ["ES_AUTH_TOKEN"]}),timeout=3).close()'\''' \
  --health-interval 15s --health-timeout 5s --health-retries 3 --health-start-period 20s \
  cswork-go-judge:1.12.3-seccomp-capacity4 >/dev/null
ready=false
for attempt in {1..30}; do
  if [[ $(docker inspect -f '{{.State.Health.Status}}' cswork-oj-sandbox) == healthy ]]; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'New runner health check failed'; exit 1; }
ln -s "$target" /srv/cswork/current.capacity-next
mv -Tf /srv/cswork/current.capacity-next /srv/cswork/current
switched=true
install -m 644 "$source_dir/deploy/cswork-oj-worker.service" /etc/systemd/system/cswork-oj-worker.service
install -m 644 "$source_dir/deploy/oj/compose.yaml" /srv/cswork/oj/compose.yaml
systemctl daemon-reload
started=$("$node" -p 'Date.now()')
systemctl start cswork-oj-worker.service
wait_for_judge "$started" || { echo 'New worker health check failed'; exit 1; }
curl -fsS --max-time 10 http://127.0.0.1:4317/api/bootstrap >/dev/null
complete=true
echo "Judge capacity release healthy: $release; rollback retained: $base"
