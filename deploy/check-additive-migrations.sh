#!/usr/bin/env bash
# Exit 0 if BASE..SHA changes the schema only additively (new migration files, a
# journal update, schema sources in db/), printing the new .sql files; exit 1 with a
# reason otherwise. release.sh applies such migrations itself; anything else needs
# deploy/install.sh.   check-additive-migrations.sh REPO_DIR BASE SHA
set -euo pipefail
repo=$1 base=$2 sha=$3
changes=$(git -C "$repo" diff --no-renames --name-status "$base" "$sha" -- drizzle)
bad=$(awk '!(($1 == "A" && $2 ~ /^drizzle\/[0-9]+_[a-z0-9_]+\.sql$/) ||
             ($1 == "A" && $2 ~ /^drizzle\/meta\/[0-9]+_snapshot\.json$/) ||
             ($1 == "M" && $2 == "drizzle/meta/_journal.json"))' <<<"$changes")
[[ -z "$bad" ]] || { echo "existing migrations changed: $(tr '\n' ' ' <<<"$bad")"; exit 1; }
added=$(awk '$1 == "A" && $2 ~ /\.sql$/ { print $2 }' <<<"$changes")
[[ -n "$added" ]] || { echo 'db/ changed without a new migration'; exit 1; }
for f in $added; do
  # Word-bounded, so updated_at / deleted_at columns are fine.
  if git -C "$repo" show "$sha:$f" | grep -qiE '\b(drop|rename|delete|update|replace)\b'; then
    echo "$f is not additive (drop/rename/delete/update/replace)"
    exit 1
  fi
done
printf '%s\n' "$added"
