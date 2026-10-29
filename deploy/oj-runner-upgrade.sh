#!/usr/bin/env bash
# One-command judge runner upgrade for perf/judge-round2: Java CDS archives
# (deploy/oj/Dockerfile.java-cds) and the extra C++ PCH sets (Dockerfile.pch,
# deploy/oj/build-cpp-pch.sh). Run as root on the judge host from a checkout of
# the reviewed commit:
#   sudo bash deploy/oj-runner-upgrade.sh
# 1. Preflight as oj-pandas-release.sh: runner (the verified -pandas image) and
#    worker running, queue not paused, no leftover pre-r2 rollback container,
#    >= 2 GiB free for Docker. A runner that already has javac.jsa: exit 0.
# 2. Build Dockerfile.java-cds, then Dockerfile.pch, on the running runner's
#    immutable image ID (reused if the candidate tag already sits on that base) and
#    smoke-test it offline with the worker's own Java/C++/Python commands.
# 3. Swap cswork-oj-sandbox exactly as oj-pandas-release.sh does: pause the queue,
#    stop the worker, keep the old runner stopped and renamed, start the candidate
#    with compose.yaml's flags, verify-runtime.py, restart the worker, wait for a
#    heartbeat (still reporting pandas), resume.
# 4. Only then move the tag: the old image keeps $image-pre-r2 and $image names the
#    new one, so compose.yaml and oj-capacity-release.sh stay unchanged and true.
# Any failure before step 4 restores the old runner, oj.env and compose.yaml (the
# tag never moved), waits for a fresh healthy heartbeat and only then resumes the
# queue. Nothing is deleted. cswork-oa-validation is not touched.
# The worker's commands already handle images with and without the archives/PCHs,
# so no app release, schema change or web restart.
set -euo pipefail
die() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die 'Run as root.'
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node=/opt/cswork/runtime/node
image=cswork-go-judge:1.12.3-seccomp-capacity4-pandas
previous_tag=$image-pre-r2
cds_image=$image-r2-cds
candidate=$image-r2
marker=/usr/local/lib/cswork/java-cds-v1/javac.jsa
old_runner=cswork-oj-sandbox-rollback-prer2
stamp=$(date -u +%Y%m%dT%H%M%SZ)
failed_runner=cswork-oj-sandbox-failed-r2-$stamp
rollback=/srv/cswork/oj-rollback/r2-$stamp

queue() { "$node" --env-file=/etc/cswork/cswork.env --env-file=/etc/cswork/oj.env "$source_dir/deploy/oj-queue-control.cjs" "$1"; }
# Healthy runner, active worker and a heartbeat newer than $1; with $2=1 the
# heartbeat must also report pandas (the new image keeps it; pd- must stay visible).
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
for file in "$node" "$source_dir/deploy/oj/Dockerfile.java-cds" "$source_dir/deploy/oj/build-java-cds.sh" \
  "$source_dir/deploy/oj/Dockerfile.pch" "$source_dir/deploy/oj/build-cpp-pch.sh" "$source_dir/deploy/oj/verify-runtime.py" \
  "$source_dir/deploy/oj/compose.yaml" /srv/cswork/oj/compose.yaml /srv/cswork/oj/verify-runtime.py \
  /srv/cswork/oj/docker-seccomp.json /etc/cswork/oj.env /etc/cswork/cswork.env; do
  [[ -s "$file" ]] || die "missing $file"
done
[[ -d "$source_dir/deploy/oj/java-cds" ]] || die "missing $source_dir/deploy/oj/java-cds"
grep -q "image: $image$" "$source_dir/deploy/oj/compose.yaml" || die "checkout's compose.yaml does not name $image"
[[ $(docker inspect -f '{{.State.Running}}' cswork-oj-sandbox 2>/dev/null) == true ]] || die 'cswork-oj-sandbox is not running'
base=$(docker inspect -f '{{.Image}}' cswork-oj-sandbox)
[[ "$base" =~ ^sha256:[0-9a-f]{64}$ ]] || die "unexpected runner image ID: $base"
if docker exec cswork-oj-sandbox test -r "$marker"; then
  # Re-run after a successful upgrade: nothing to swap.
  echo "cswork-oj-sandbox already runs an image with $marker ($base); nothing to do."
  [[ "$base" == "$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null)" ]] ||
    echo "warning: $image does not name the running image; to fix: sudo docker tag $base $image" >&2
  exit 0
fi
systemctl is-active --quiet cswork-oj-worker.service || die 'cswork-oj-worker.service is not active'
# Upgrades only the verified pandas runner (what oj-capacity-release.sh also requires).
[[ "$base" == "$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null)" ]] ||
  die "cswork-oj-sandbox does not run $image; run deploy/oj-pandas-release.sh first"
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
if [[ "$(layers "$candidate" 2>/dev/null)" == "$base_layers"?* ]]; then
  echo "Reusing $candidate, already built on $base"
else
  docker image inspect "$candidate" >/dev/null 2>&1 && echo "Rebuilding $candidate: the existing tag is not built on $base (the old image stays, untagged)"
  # Same capped classic builder as deploy/oj/install.sh, to keep the shared host responsive.
  DOCKER_BUILDKIT=0 docker build --cpu-period 100000 --cpu-quota 200000 --memory 2g \
    -f "$source_dir/deploy/oj/Dockerfile.java-cds" --build-arg BASE_IMAGE="$base" -t "$cds_image" "$source_dir/deploy/oj"
  [[ "$(layers "$cds_image")" == "$base_layers"?* ]] || die "$cds_image is not built on $base"
  cds_id=$(docker image inspect -f '{{.Id}}' "$cds_image")
  DOCKER_BUILDKIT=0 docker build --cpu-period 100000 --cpu-quota 200000 --memory 2g \
    -f "$source_dir/deploy/oj/Dockerfile.pch" --build-arg BASE_IMAGE="$cds_id" -t "$candidate" "$source_dir/deploy/oj"
  [[ "$(layers "$candidate")" == "$(layers "$cds_id")"?* ]] || die "$candidate is not built on $cds_image"
fi
new_id=$(docker image inspect -f '{{.Id}}' "$candidate")
# The worker's own commands (lib/server/oj-engine.ts, leetcode-mode.ts) as the
# sandbox user, offline; -Xshare:on and g++ -H prove the archives/PCHs are used.
docker run --rm -i --network none --user 1536:1536 --memory 1g --pids-limit 64 \
  --tmpfs /tmp:rw,exec,nosuid,nodev,size=256m --entrypoint /bin/sh "$candidate" -s <<'SMOKE' || die "$candidate failed the offline smoke test"
set -eu
fail() { echo "smoke: $*" >&2; exit 1; }
mkdir /tmp/java /tmp/cpp /tmp/cpp/cswork && cd /tmp/java
cat > Main.java <<'EOF'
import java.util.*;
import java.util.stream.*;
public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        List<Integer> xs = new ArrayList<>();
        while (in.hasNextInt()) xs.add(in.nextInt());
        System.out.println(xs.stream().sorted().map(String::valueOf).collect(Collectors.joining(" ")));
    }
}
EOF
cds=/usr/local/lib/cswork/java-cds-v1/javac.jsa
test -r $cds || fail "missing $cds"
# The compile command with -J-Xshare:on: javac fails unless javac.jsa maps.
/usr/bin/javac -J-Xshare:on -J-XX:TieredStopAtLevel=1 -J-XX:+UseSerialGC -J-XX:-UsePerfData "-J-Xlog:cds*=off" \
  -J-XX:SharedArchiveFile=$cds -encoding UTF-8 Main.java > javac.out 2>&1 || { cat javac.out >&2; fail 'javac with javac.jsa failed'; }
[ ! -s javac.out ] || { cat javac.out >&2; fail 'javac printed output'; }
/usr/bin/python3 -I -c 'import glob, zipfile
with zipfile.ZipFile("main.jar", "w", zipfile.ZIP_DEFLATED) as jar:
    [jar.write(name) for name in sorted(glob.glob("*.class"))]'
# javaCommand(256 MiB): with -Xshare:on the JVM fails unless the default
# classes.jsa maps; then exactly as judged, stdout must be the program's alone.
run() { echo '3 1 2' | /usr/bin/java "$@" -XX:-UsePerfData -Xmx153m -Xss64m -XX:ReservedCodeCacheSize=32m \
  -XX:MaxMetaspaceSize=64m -XX:ActiveProcessorCount=1 -cp main.jar Main; }
out=$(run -Xshare:on -Xlog:class+load=info:file=/tmp/java/load.log) || fail 'java -Xshare:on failed'
[ "$out" = '1 2 3' ] || fail "java -Xshare:on stdout: $out"
grep -q 'java.util.Scanner source: shared objects file' load.log || fail 'java.util.Scanner not loaded from the CDS archive'
out=$(run) || fail 'java failed'
[ "$out" = '1 2 3' ] || fail "java stdout (cds warning?): $out"
echo "Smoke test: Java CDS maps for javac and the JVM: $(/usr/bin/java -version 2>&1 | head -1)"

cd /tmp/cpp
printf '#include <iostream>\n#include <vector>\n#include <algorithm>\nint main() {\n  std::vector<int> v{3, 1, 2};\n  std::sort(v.begin(), v.end());\n  for (int x : v) std::cout << x;\n  std::cout << "\\n";\n}\n' > main.cpp
pch=/usr/local/include/cswork/pch/iostream-vector-algorithm.hpp
test -r "$pch.gch" || fail "missing $pch.gch"
/usr/bin/g++ -std=c++20 -O2 -pipe -include "$pch" main.cpp -o main -H 2> h.txt || { cat h.txt >&2; fail 'g++ with the header-set PCH failed'; }
grep -qF "! $pch.gch" h.txt || fail "$pch.gch was not used"
[ "$(./main)" = 123 ] || fail 'header-set PCH program output'
# withStdcxxPch's rewrite, with STDCXX_FALLBACK in the sandbox as the worker sends it.
printf '#include <bits/stdc++.h>\n' > cswork/stdc++.hpp
printf '#include <cswork/stdc++.hpp>\nusing namespace std;\nint main() {\n  vector<int> v{3, 1, 2};\n  sort(v.begin(), v.end());\n  for (int x : v) cout << x;\n  cout << "\\n";\n}\n' > main.cpp
/usr/bin/g++ -std=c++20 -O2 -pipe -idirafter . main.cpp -o main -H 2> h.txt || { cat h.txt >&2; fail 'g++ with the stdc++ PCH failed'; }
grep -qF '! /usr/local/include/cswork/stdc++.hpp.gch' h.txt || fail 'the bits/stdc++ PCH was not used'
[ "$(./main)" = 123 ] || fail 'bits/stdc++ PCH program output'
echo 'Smoke test: iostream-vector-algorithm and bits/stdc++ PCHs compile and run'

/usr/bin/python3 -I -c 'import pandas; print("Smoke test: pandas " + pandas.__version__ + " imports")'
SMOKE

# --- Swap. Backups first, so every rollback path has them.
install -d -m 700 /srv/cswork/oj-rollback "$rollback"
cp -a /etc/cswork/oj.env /srv/cswork/oj/compose.yaml /srv/cswork/oj/verify-runtime.py "$rollback/"
paused=false
worker_touched=false
# Again right before pausing: someone may have started maintenance during the build.
queue status | "$node" -e 'let text="";process.stdin.on("data",v=>text+=v);process.stdin.on("end",()=>{if(JSON.parse(text).paused){console.error("Queue is already paused; preserve maintenance and abort");process.exit(1)}})'
runner_stopped=false
renamed=false
complete=false
finish() {
  code=$?
  trap - EXIT
  # A dropped SSH session or Ctrl-C must not stop a rollback or the queue resume halfway.
  trap '' HUP INT TERM
  set +e
  recovery_failed=false
  if [[ "$complete" != true && "$worker_touched" == true ]]; then
    echo "Runner upgrade failed (exit $code); restoring the previous runner." >&2
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
    cp -a "$rollback/oj.env" /etc/cswork/oj.env || recovery_failed=true
    cp -a "$rollback/compose.yaml" "$rollback/verify-runtime.py" /srv/cswork/oj/ || recovery_failed=true
    recovery_started=$("$node" -p 'Date.now()')
    systemctl start cswork-oj-worker.service || recovery_failed=true
    wait_for_judge "$recovery_started" 0 || recovery_failed=true
    if [[ "$recovery_failed" != true ]]; then
      echo "Previous judge runner, oj.env and compose.yaml restored; $image still names it. Backups: $rollback"
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
# (tests/oj-runner-swap.test.mjs keeps this, the other swap scripts and compose.yaml
# equal). The candidate tag runs here; $image moves to it only after success.
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
  "$candidate" >/dev/null
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
# Move the compose tag to the running image (oj-capacity-release.sh checks they match);
# the old image keeps a name. A failure here leaves the new runner serving.
docker tag "$base" "$previous_tag"
docker tag "$candidate" "$image"
queue_control="$node --env-file=/etc/cswork/cswork.env --env-file=/etc/cswork/oj.env $source_dir/deploy/oj-queue-control.cjs"
echo
echo "Judge runner upgrade (Java CDS + C++ PCHs) healthy; queue resumes on exit."
echo "  runner:     cswork-oj-sandbox on $image = $candidate ($new_id)"
echo "  previous:   $previous_tag ($base)"
echo "  pandas:     $pandas_version, reported by the worker heartbeat"
echo "  limits:     before $old_limits"
echo "              after  $(limits cswork-oj-sandbox)"
echo "  rollback:   container $old_runner (stopped, image $base), files $rollback"
echo "  untouched:  cswork-oa-validation; nothing was deleted"
echo "Manual rollback (the old runner and the tag back on the old image):"
echo "  sudo $queue_control pause && sudo systemctl stop cswork-oj-worker.service"
echo "  sudo docker stop cswork-oj-sandbox && sudo docker rename cswork-oj-sandbox cswork-oj-sandbox-r2"
echo "  sudo docker rename $old_runner cswork-oj-sandbox && sudo docker start cswork-oj-sandbox"
echo "  sudo docker tag $previous_tag $image   # compose.yaml / oj-capacity-release.sh name the old image again"
echo "  sudo cp -a $rollback/oj.env /etc/cswork/oj.env && sudo cp -a $rollback/compose.yaml /srv/cswork/oj/compose.yaml"
echo "  sudo systemctl start cswork-oj-worker.service && sudo $queue_control resume"
echo "Cleanup once satisfied (owner; keep the $base image, cswork-oa-validation may use it):"
echo "  sudo docker rm $old_runner && sudo rm -r $rollback"
