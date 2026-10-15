#!/usr/bin/env bash
# One-command pandas upgrade of the running judge runner, which un-hides the pd-
# problems (lib/server/oj-problems.ts shows them once the worker reports pandas).
# Run as root on the judge host from a checkout of the reviewed commit:
#   sudo bash deploy/oj-pandas-release.sh
# 1. Preflight: runner and worker running, queue not paused, no leftover
#    pre-pandas rollback container, >= 2 GiB free for Docker.
# 2. Build deploy/oj/Dockerfile.pandas on the running runner's immutable image ID
#    (reused if the tag already sits on that base) and smoke-test it offline.
# 3. Swap cswork-oj-sandbox as oj-capacity-release.sh does: drain and pause the
#    queue, stop the worker, keep the old runner stopped and renamed, start the new
#    one with compose.yaml's flags, then verify-runtime.py (records pandas in
#    OJ_LANGUAGE_VERSIONS) and restart the worker; resume the queue only once the
#    worker heartbeat reports pandas.
# Any failure restores the old runner, oj.env and compose.yaml, waits for a fresh
# healthy heartbeat and only then resumes the queue. Nothing is deleted: the old
# runner/image, a failed new runner and the backups stay for the owner to clean up.
# cswork-oa-validation is not touched: pd- visibility depends only on the worker's
# runner (GO_JUDGE_URL, cswork-oj-sandbox).
# Ordering: compose.yaml and oj-capacity-release.sh in this checkout already name
# the -pandas tag; oj-capacity-release.sh refuses to run until this has succeeded.
# No app release, schema change or web restart.
set -euo pipefail
die() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die 'Run as root.'
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node=/opt/cswork/runtime/node
image=cswork-go-judge:1.12.3-seccomp-capacity4-pandas
old_runner=cswork-oj-sandbox-rollback-prepandas
stamp=$(date -u +%Y%m%dT%H%M%SZ)
failed_runner=cswork-oj-sandbox-failed-pandas-$stamp
rollback=/srv/cswork/oj-rollback/pandas-$stamp

queue() { "$node" --env-file=/etc/cswork/cswork.env --env-file=/etc/cswork/oj.env "$source_dir/deploy/oj-queue-control.cjs" "$1"; }
# Healthy runner, active worker and a heartbeat newer than $1; with $2=1 the
# heartbeat must also report pandas (what the web uses to show pd- problems).
wait_for_judge() {
  local started=$1 need_pandas=$2
  for attempt in {1..60}; do
    if [[ $(docker inspect -f '{{.State.Health.Status}}' cswork-oj-sandbox 2>/dev/null) == healthy ]] &&
      systemctl is-active --quiet cswork-oj-worker.service &&
      STARTED="$started" NEED_PANDAS="$need_pandas" "$node" --env-file=/etc/cswork/cswork.env --input-type=module -e '
        import {createRequire} from "node:module";
        const Database=createRequire("/srv/cswork/current/package.json")("better-sqlite3");
        const db=new Database(process.env.DATABASE_PATH,{readonly:true});
        const row=db.prepare("SELECT healthy,heartbeat_at,details FROM oj_runtime WHERE id=?").get("worker");db.close();
        const pandas=JSON.parse(row?.details||"{}").languageVersions?.pandas;
        process.exit(row?.healthy && row.heartbeat_at>=Number(process.env.STARTED) && Date.now()-row.heartbeat_at<15000 &&
          (process.env.NEED_PANDAS!=="1" || pandas) ? 0 : 1);'; then return 0; fi
    sleep 1
  done
  return 1
}
limits() { docker inspect -f 'memory={{.HostConfig.Memory}} swap={{.HostConfig.MemorySwap}} nanocpus={{.HostConfig.NanoCpus}} cpu-shares={{.HostConfig.CpuShares}} pids={{.HostConfig.PidsLimit}}' "$1"; }
layers() { docker image inspect -f '{{range .RootFS.Layers}}{{.}} {{end}}' "$1"; }

# --- Preflight: read-only.
for file in "$node" "$source_dir/deploy/oj/Dockerfile.pandas" "$source_dir/deploy/oj/verify-runtime.py" \
  "$source_dir/deploy/oj/compose.yaml" /srv/cswork/oj/compose.yaml /srv/cswork/oj/verify-runtime.py \
  /srv/cswork/oj/docker-seccomp.json /etc/cswork/oj.env /etc/cswork/cswork.env; do
  [[ -s "$file" ]] || die "missing $file"
done
grep -q "image: $image$" "$source_dir/deploy/oj/compose.yaml" || die "checkout's compose.yaml does not name $image"
[[ $(docker inspect -f '{{.State.Running}}' cswork-oj-sandbox 2>/dev/null) == true ]] || die 'cswork-oj-sandbox is not running'
systemctl is-active --quiet cswork-oj-worker.service || die 'cswork-oj-worker.service is not active'
base=$(docker inspect -f '{{.Image}}' cswork-oj-sandbox)
[[ "$base" =~ ^sha256:[0-9a-f]{64}$ ]] || die "unexpected runner image ID: $base"
if [[ "$base" == "$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null)" ]]; then
  # Re-run after a successful rollout: nothing to swap.
  if wait_for_judge 0 1; then echo "cswork-oj-sandbox already runs $image and the worker reports pandas; nothing to do."; exit 0; fi
  die "cswork-oj-sandbox already runs $image but the worker does not report pandas. Run: sudo python3 $source_dir/deploy/oj/verify-runtime.py && sudo systemctl restart cswork-oj-worker.service"
fi
! docker inspect "$old_runner" >/dev/null 2>&1 || die "$old_runner already exists (an earlier rollout's rollback); inspect it before retrying"
docker_root=$(docker info -f '{{.DockerRootDir}}')
(( $(df --output=avail -B1 "$docker_root" | tail -1) >= 2147483648 )) || die "less than 2 GiB free under $docker_root"
queue status | "$node" -e 'let text="";process.stdin.on("data",v=>text+=v);process.stdin.on("end",()=>{if(JSON.parse(text).paused){console.error("Queue is already paused; preserve maintenance and abort");process.exit(1)}})'
old_limits=$(limits cswork-oj-sandbox)
echo "Runner: cswork-oj-sandbox on $base ($old_limits)"
other_runners=$(docker ps -a --filter name=cswork-oj-sandbox- --format '{{.Names}}')
[[ -z "$other_runners" ]] || echo "Note: runner containers kept from earlier releases: $other_runners"

# --- Build and offline smoke test; the live judge keeps serving meanwhile.
base_layers=$(layers "$base")
if [[ "$(layers "$image" 2>/dev/null)" == "$base_layers"?* ]]; then
  echo "Reusing $image, already built on $base"
else
  docker image inspect "$image" >/dev/null 2>&1 && echo "Rebuilding $image: the existing tag is not built on $base (the old image stays, untagged)"
  # Same capped classic builder as deploy/oj/install.sh, to keep the shared host responsive.
  DOCKER_BUILDKIT=0 docker build --cpu-period 100000 --cpu-quota 200000 --memory 2g \
    -f "$source_dir/deploy/oj/Dockerfile.pandas" --build-arg BASE_IMAGE="$base" -t "$image" "$source_dir/deploy/oj"
  [[ "$(layers "$image")" == "$base_layers"?* ]] || die "$image is not built on $base"
fi
new_id=$(docker image inspect -f '{{.Id}}' "$image")
# As PANDAS_HARNESS uses it: the sandbox user, no network, single-threaded BLAS.
docker run --rm --network none --user 1536:1536 --memory 1g --pids-limit 64 --entrypoint /usr/bin/python3 "$image" -I -c '
import os
os.environ["OPENBLAS_NUM_THREADS"] = os.environ["OMP_NUM_THREADS"] = "1"
import sqlite3, pandas
frame = pandas.read_sql_query("SELECT 1 AS x", sqlite3.connect(":memory:"), dtype={"x": "Int64"})
assert int(frame["x"].sum()) == 1
print("Smoke test: pandas " + pandas.__version__ + " imports and reads SQLite offline")' || die "$image failed the offline pandas smoke test"

# --- Swap. Backups first, so every rollback path has them.
install -d -m 700 /srv/cswork/oj-rollback "$rollback"
cp -a /etc/cswork/oj.env /srv/cswork/oj/compose.yaml /srv/cswork/oj/verify-runtime.py "$rollback/"
paused=false
worker_touched=false
runner_stopped=false
renamed=false
complete=false
finish() {
  code=$?
  trap - EXIT
  set +e
  recovery_failed=false
  if [[ "$complete" != true && "$worker_touched" == true ]]; then
    echo "Pandas rollout failed (exit $code); restoring the previous runner." >&2
    systemctl stop cswork-oj-worker.service || recovery_failed=true
    if [[ "$renamed" == true ]]; then
      # Keep a failed new runner, stopped and renamed, for its logs.
      if docker inspect cswork-oj-sandbox >/dev/null 2>&1; then
        docker stop -t 5 cswork-oj-sandbox >/dev/null
        docker rename cswork-oj-sandbox "$failed_runner" || recovery_failed=true
      fi
      docker rename "$old_runner" cswork-oj-sandbox || recovery_failed=true
      docker start cswork-oj-sandbox >/dev/null || recovery_failed=true
    elif [[ "$runner_stopped" == true ]]; then
      docker start cswork-oj-sandbox >/dev/null || recovery_failed=true
    fi
    # The old OJ_LANGUAGE_VERSIONS (no pandas) matches the old runner: pd- stays hidden.
    cp -a "$rollback/oj.env" /etc/cswork/oj.env || recovery_failed=true
    cp -a "$rollback/compose.yaml" "$rollback/verify-runtime.py" /srv/cswork/oj/ || recovery_failed=true
    recovery_started=$("$node" -p 'Date.now()')
    systemctl start cswork-oj-worker.service || recovery_failed=true
    wait_for_judge "$recovery_started" 0 || recovery_failed=true
    if [[ "$recovery_failed" != true ]]; then
      echo "Previous judge runner, oj.env and compose.yaml restored; pd- problems stay hidden. Backups: $rollback"
      if [[ "$renamed" == true ]]; then echo "A failed new runner, if one started, is kept stopped as $failed_runner for its logs."; fi
    fi
  fi
  if [[ "$recovery_failed" == true ]]; then
    echo "ERROR: rollback needs attention. Queue remains paused; old runner=$old_runner backups=$rollback"
    exit 1
  fi
  if [[ "$paused" == true ]]; then queue resume || { echo 'ERROR: judge is ready but queue resume failed'; exit 1; }; fi
  exit "$code"
}
trap finish EXIT
paused=true
queue pause
worker_touched=true
systemctl stop cswork-oj-worker.service
runner_stopped=true
docker stop -t 20 cswork-oj-sandbox >/dev/null
docker rename cswork-oj-sandbox "$old_runner"
renamed=true
set -a
source /etc/cswork/oj.env
set +a
export ES_AUTH_TOKEN="$GO_JUDGE_TOKEN"
# Same security, network and resource settings as the reviewed compose service
# (tests/oj-runner-swap.test.mjs keeps this, oj-capacity-release.sh and compose.yaml equal).
docker run -d --name cswork-oj-sandbox --restart unless-stopped \
  --label com.docker.compose.project=cswork-oj --label com.docker.compose.service=sandbox \
  --label com.docker.compose.container-number=1 --label com.docker.compose.oneoff=False \
  --label com.docker.compose.project.working_dir=/srv/cswork/oj \
  --label com.docker.compose.project.config_files=/srv/cswork/oj/compose.yaml \
  --network cswork-oj_judge --network-alias sandbox \
  --cgroupns private --cap-add SYS_ADMIN --cap-drop NET_RAW \
  --security-opt apparmor=unconfined --security-opt systempaths=unconfined \
  --security-opt no-new-privileges:true --security-opt seccomp=/srv/cswork/oj/docker-seccomp.json \
  -p 127.0.0.1:5050:5050 -e ES_AUTH_TOKEN -e GOMAXPROCS="${OJ_RUNNER_GOMAXPROCS:-3}" -e GOMEMLIMIT=512MiB \
  -e OJ_RUNNER_PARALLELISM="${OJ_RUNNER_PARALLELISM:-4}" --memory 6g --memory-swap 6g --cpus "${OJ_RUNNER_CPUS:-4}" --cpu-shares 512 \
  --pids-limit 512 --shm-size 512m --tmpfs /tmp:rw,nosuid,nodev,size=768m \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  --health-cmd '/usr/bin/python3 -c '\''import os,urllib.request;urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5050/version",headers={"Authorization":"Bearer "+os.environ["ES_AUTH_TOKEN"]}),timeout=3).close()'\''' \
  --health-interval 15s --health-timeout 5s --health-retries 3 --health-start-period 20s \
  "$image" >/dev/null
ready=false
for attempt in {1..60}; do
  if [[ $(docker inspect -f '{{.State.Health.Status}}' cswork-oj-sandbox) == healthy ]]; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || die 'New runner health check failed'
install -m 644 "$source_dir/deploy/oj/compose.yaml" /srv/cswork/oj/compose.yaml
install -m 644 "$source_dir/deploy/oj/verify-runtime.py" /srv/cswork/oj/verify-runtime.py
# Full runtime verification of the new runner; rewrites OJ_LANGUAGE_VERSIONS in oj.env.
python3 "$source_dir/deploy/oj/verify-runtime.py"
pandas_version=$(sed -n 's/^OJ_LANGUAGE_VERSIONS=.*"pandas":"\([^"]*\)".*/\1/p' /etc/cswork/oj.env)
[[ -n "$pandas_version" ]] || die 'verify-runtime.py did not record pandas in OJ_LANGUAGE_VERSIONS'
started=$("$node" -p 'Date.now()')
systemctl start cswork-oj-worker.service
wait_for_judge "$started" 1 || die 'New worker heartbeat is not healthy with pandas'
curl -fsS --max-time 10 http://127.0.0.1:4317/api/bootstrap >/dev/null
complete=true
pd_count=$("$node" --env-file=/etc/cswork/cswork.env --input-type=module -e '
  import {createRequire} from "node:module";
  const Database=createRequire("/srv/cswork/current/package.json")("better-sqlite3");
  const db=new Database(process.env.DATABASE_PATH,{readonly:true});
  console.log(db.prepare("SELECT count(*) AS n FROM oj_problems WHERE id LIKE ? AND published=1").get("pd-%").n);db.close();') || pd_count='?'
queue_control="$node --env-file=/etc/cswork/cswork.env --env-file=/etc/cswork/oj.env $source_dir/deploy/oj-queue-control.cjs"
echo
echo "Judge pandas rollout healthy; queue resumes on exit."
echo "  runner:       cswork-oj-sandbox on $image ($new_id)"
echo "  pandas:       $pandas_version, reported by the worker heartbeat"
echo "  pd- problems: $pd_count published, now visible"
echo "  limits:       before $old_limits"
echo "                after  $(limits cswork-oj-sandbox)"
echo "  rollback:     container $old_runner (stopped, image $base), files $rollback"
echo "  untouched:    cswork-oa-validation; nothing was deleted"
echo "Manual rollback (hides pd- again):"
echo "  sudo $queue_control pause && sudo systemctl stop cswork-oj-worker.service"
echo "  sudo docker stop cswork-oj-sandbox && sudo docker rename cswork-oj-sandbox cswork-oj-sandbox-pandas"
echo "  sudo docker rename $old_runner cswork-oj-sandbox && sudo docker start cswork-oj-sandbox"
echo "  sudo cp -a $rollback/oj.env /etc/cswork/oj.env && sudo cp -a $rollback/compose.yaml /srv/cswork/oj/compose.yaml"
echo "  sudo systemctl start cswork-oj-worker.service && sudo $queue_control resume"
echo "Cleanup once satisfied (owner; keep the $base image, cswork-oa-validation uses it):"
echo "  sudo docker rm $old_runner && sudo rm -r $rollback"
