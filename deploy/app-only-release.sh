#!/usr/bin/env bash
# Only for reviewed, schema/runtime-compatible changes. Never runs migrations.
set -euo pipefail
base=${1:?Exact currently deployed commit SHA}
release=${2:?Tested candidate commit SHA}
build=${3:?Absolute source build directory containing dist/standalone}
node=${4:?Installed production Node binary}
[[ $EUID -eq 0 && "$base" =~ ^[a-f0-9]{40}$ && "$release" =~ ^[a-f0-9]{40}$ && "$base" != "$release" && "$build" = /* && "$node" = /* ]] || exit 2
[[ -x "$node" && $(readlink -f "$node") == $(readlink -f /opt/cswork/runtime/node) ]] || { echo 'Use the existing production Node runtime'; exit 2; }
exec 9>/run/lock/cswork-app-release.lock
flock -n 9 || { echo 'Another application release is running'; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
build=$(realpath -e "$build")
artifact="$build/dist/standalone"
previous=$(readlink -f /srv/cswork/current)
target="/srv/cswork/releases/$release"
test -L /srv/cswork/current
[[ "$previous" == "/srv/cswork/releases/$base" && $(cat "$previous/REVISION") == "$base" ]] || { echo 'Deployed base changed; aborting'; exit 1; }
[[ ! -e "$target" && ! -L "$target" ]] || { echo 'Candidate release already exists'; exit 1; }
for required in server.js package.json oj-worker/index.mjs content/oa-master/catalog.json content/oa-master/manifest.json; do
  test -s "$artifact/$required"
done
test -d "$artifact/node_modules"
test -s "$build/scripts/backup.mjs"
test -s "$source_dir/deploy/oj-queue-control.cjs"
systemctl is-active --quiet cswork.service
systemctl is-active --quiet cswork-oj-worker.service
required_bytes=$(du -sb "$artifact" | awk '{print $1}')
available_bytes=$(df --output=avail -B1 /srv/cswork | tail -1)
(( available_bytes > required_bytes + 536870912 )) || { echo 'Insufficient disk space for candidate plus 512 MiB reserve'; exit 1; }
queue() { "$node" --env-file=/etc/cswork/cswork.env --env-file=/etc/cswork/oj.env "$source_dir/deploy/oj-queue-control.cjs" "$1"; }
queue status | "$node" -e 'let text="";process.stdin.on("data",v=>text+=v);process.stdin.on("end",()=>{if(JSON.parse(text).paused){console.error("Queue already paused; preserve maintenance and abort");process.exit(1)}})'

# Independent copy leaves the rollback release untouched. No user data is copied.
cp -a "$artifact" "$target"
install -d -m 755 "$target/scripts"
install -m 644 "$build/scripts/backup.mjs" "$target/scripts/backup.mjs"
# Domain operations run from the live release: sudo bash /srv/cswork/current/deploy/domain-cutover.sh
install -d -m 755 "$target/deploy"
install -m 644 "$build/deploy/domain-cutover.sh" "$build/deploy/configure-nginx.py" "$target/deploy/"
printf '%s\n' "$release" > "$target/REVISION"
printf 'app-only\nbase=%s\n' "$base" > "$target/RELEASE_KIND"
chown -R root:root "$target"
chmod -R a+rX "$target"

wait_for_health() {
  local started=$1
  for attempt in {1..40}; do
    if systemctl is-active --quiet cswork.service && systemctl is-active --quiet cswork-oj-worker.service &&
      curl -fsS --connect-timeout 2 --max-time 3 http://127.0.0.1:4317/api/bootstrap |
        "$node" -e 'let text="";process.stdin.on("data",v=>text+=v);process.stdin.on("end",()=>{const r=JSON.parse(text);process.exit(Array.isArray(r.courses)&&Array.isArray(r.problems)&&r.problems.length>0&&r.services?.password ? 0 : 1)})' &&
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
switch_to() {
  local destination=$1
  # A unique owned directory avoids clobbering another deployment's temporary link.
  local link_dir
  link_dir=$(mktemp -d /srv/cswork/.app-switch.XXXXXX) || return 1
  ln -s "$destination" "$link_dir/current" || return 1
  mv -Tf "$link_dir/current" /srv/cswork/current || return 1
  rmdir "$link_dir" || return 1
}
paused=false
touched=false
complete=false
finish() {
  code=$?
  trap - EXIT INT TERM
  set +e
  recovery_failed=false
  if [[ "$complete" != true && "$touched" == true ]]; then
    systemctl stop cswork-oj-worker.service || recovery_failed=true
    switch_to "$previous" || recovery_failed=true
    recovery_started=$("$node" -p 'Date.now()')
    systemctl restart cswork.service || recovery_failed=true
    systemctl start cswork-oj-worker.service || recovery_failed=true
    wait_for_health "$recovery_started" || recovery_failed=true
    [[ "$recovery_failed" == true ]] || echo "Previous application restored: $base"
  fi
  if [[ "$recovery_failed" == true ]]; then
    echo "ERROR: rollback needs attention; queue remains paused. Previous: $previous"
    exit 1
  fi
  if [[ "$paused" == true ]]; then
    queue resume || { echo 'ERROR: application healthy but queue resume failed'; exit 1; }
  fi
  exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Recheck immediately before mutation; do not override pre-existing maintenance.
queue status | "$node" -e 'let text="";process.stdin.on("data",v=>text+=v);process.stdin.on("end",()=>process.exit(JSON.parse(text).paused ? 1 : 0))'
[[ $(readlink -f /srv/cswork/current) == "$previous" ]] || { echo 'Deployed base changed during preparation'; exit 1; }
paused=true
echo 'Pausing admission to workers and draining active submissions (up to 240 seconds).'
queue pause
# Never stop the worker if draining failed; the trap only resumes the queue then.
touched=true
systemctl stop cswork-oj-worker.service
switch_to "$target"
started=$("$node" -p 'Date.now()')
systemctl restart cswork.service
systemctl start cswork-oj-worker.service
wait_for_health "$started" || { echo 'Candidate application health check failed'; exit 1; }
complete=true
echo "Application release healthy: $release; rollback retained: $base"
