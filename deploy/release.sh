#!/usr/bin/env bash
# One-command production release, run on the server as the deploy user (sudo required):
#   ssh ubuntu@SERVER 'bash -s -- [REF] [TEACHER_EMAIL]' < deploy/release.sh
# Green GitHub checks -> build in RAM (/dev/shm/cswork-builds) -> app-only deploy (health check + auto rollback)
# -> publish every verified OA batch not yet in production -> remove the build.
set -euo pipefail
ref=${1:-main}
repo=${CSWORK_REPO:-git@github.com:RedInn7/cswork.git}
api=https://api.github.com/repos/RedInn7/cswork
prod_node=/opt/cswork/runtime/node
# A build peaks around 7GiB; the root disk holds the live DB, so builds go to tmpfs.
builds=${CSWORK_BUILDS:-/dev/shm/cswork-builds}
env_file=/etc/cswork/cswork.env
log() { printf '[release %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

exec 8>/tmp/cswork-release.lock
flock -n 8 || die 'another release is running'

# Build with the exact production Node so native modules (better-sqlite3) match its ABI.
version=$("$prod_node" -v)
export PATH="${NODE_BIN_DIR:-$HOME/.nvm/versions/node/$version/bin}:$PATH"
[[ $(node -v) == "$version" ]] || die "need Node $version for building (set NODE_BIN_DIR)"

email=${2:-$(sudo sed -n 's/^ADMIN_EMAILS=//p' "$env_file" | cut -d, -f1 | tr -d ' ')}
[[ -n "$email" ]] || die 'no teacher email given and no ADMIN_EMAILS configured'

if [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then sha=$ref; else
  sha=$(git ls-remote "$repo" "refs/heads/$ref" | cut -f1)
fi
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "cannot resolve $ref"
base=$(cat /srv/cswork/current/REVISION)
log "target $sha ($ref), deployed $base"

# CI gate: every check run on this exact commit must have finished successfully.
checks=$(curl -fsS "$api/commits/$sha/check-runs?per_page=100")
node -e '
  const runs=JSON.parse(process.argv[1]).check_runs;
  const bad=runs.filter(r=>r.status!=="completed"||!["success","skipped","neutral"].includes(r.conclusion));
  if(!runs.length){console.error("no CI checks found for this commit");process.exit(1)}
  if(bad.length){console.error("CI not green: "+bad.map(r=>r.name+"="+(r.conclusion||r.status)).join(", "));process.exit(1)}
' "$checks" || die 'refusing to release without green CI'
log 'CI green'

# Stale builds from failed runs only waste disk; the deployed copy lives in /srv/cswork/releases.
sudo install -d -o "$USER" -g "$USER" -m 755 "$builds"
find "$builds" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
dir="$builds/$sha"
# Never leave gigabytes of build in RAM, even when a step fails.
trap 'rm -rf "$dir"' EXIT
free_gib=$(( $(df --output=avail -B1 "$builds" | tail -1) / 1073741824 ))
(( free_gib >= ${MIN_FREE_GIB:-8} )) || die "only ${free_gib}GiB free; a build needs about 7GiB"
git clone -q --filter=blob:none --no-checkout "$repo" "$dir"
git -C "$dir" checkout -q "$sha"

if [[ "$sha" != "$base" ]]; then
  git -C "$dir" cat-file -e "$base^{commit}" 2>/dev/null ||
    die "deployed commit $base is not in the repository; cannot compare schemas"
  # New tables and indexes migrate here, before the new app starts; the running app
  # ignores them. Anything else (drop, rename, rewrite) needs a full install.sh release.
  migrations=''
  if ! git -C "$dir" diff --quiet "$base" "$sha" -- drizzle db; then
    migrations=$(bash "$dir/deploy/check-additive-migrations.sh" "$dir" "$base" "$sha") ||
      die "schema change between $base and $sha: $migrations; use deploy/install.sh"
  fi
  log 'installing and building'
  (cd "$dir" && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null)
  if [[ -n "$migrations" ]]; then
    log "applying additive migrations: $(tr '\n' ' ' <<<"$migrations")"
    (cd "$dir" && sudo -u cswork "$prod_node" --env-file="$env_file" scripts/migrate.mjs) ||
      die 'migration failed; nothing deployed'
  fi
  log 'deploying'
  sudo bash "$dir/deploy/app-only-release.sh" "$base" "$sha" "$dir" "$prod_node"
else
  log 'already deployed; only publishing'
  (cd "$dir" && npm ci --no-audit --no-fund >/dev/null)
fi

# Builds are world-readable, so the service user reads them directly.
as_cswork() { (cd "$dir" && sudo -u cswork "$prod_node" --env-file="$env_file" "$@"); }
# Process substitution would hide a crash; capture first so a failure stops the release clearly.
listed=$(as_cswork scripts/oa-judge/unpublished-batches.mjs) || die 'could not list unpublished OA batches'
mapfile -t pending < <(printf '%s' "$listed" | sed '/^$/d')
log "${#pending[@]} OA batch(es) to publish"
for batch in "${pending[@]}"; do
  out=$(as_cswork --import tsx scripts/publish-oa-judge.ts --batch "$batch" "$email")
  log "$batch: $(grep -c '"published"' <<<"$out" || true) problem(s) published"
done
left=$(as_cswork scripts/oa-judge/unpublished-batches.mjs) || die 'could not recheck OA batches'
[[ -z "$left" ]] || die "still unpublished: $(tr '\n' ' ' <<<"$left")"
# First-party SQL track and its pandas versions: CI-verified packages; unchanged ones are skipped.
out=$(as_cswork --import tsx scripts/publish-sql-track.ts "$email") || die 'could not publish the SQL track'
log "SQL track (SQL and pandas): $(grep -c '"published"' <<<"$out" || true) problem(s) published"
# REST API problems wait for content/rest-api/sandbox-report.json (scripts/rest-api/verify-sandbox.mjs).
log "REST API: $(grep -c '"unverified"' <<<"$out" || true) problem(s) await a go-judge report"
# First-party Core Skills track: CI reruns every language's solution; unchanged ones are skipped.
out=$(as_cswork --import tsx scripts/publish-core-skills.ts "$email") || die 'could not publish the Core Skills track'
log "Core Skills: $(grep -c '"published"' <<<"$out" || true) problem(s) published"
# Book problems (剑指 Offer / 面试金典 rows without a LeetCode twin): same, CI-verified.
out=$(as_cswork --import tsx scripts/publish-book-problems.ts "$email") || die 'could not publish the book problems'
log "book problems: $(grep -c '"published"' <<<"$out" || true) problem(s) published"

curl -fsS -o /dev/null http://127.0.0.1:4317/api/bootstrap || die 'site not answering after publish'
rm -rf "$dir"
log "done: production at $(cat /srv/cswork/current/REVISION), all verified OA batches published"
