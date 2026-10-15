#!/usr/bin/env bash
# No release history by default: after a healthy release, keep only the live release and the
# rollback target passed in; every other releases/<sha> directory goes. Never fails its caller.
# Usage: prune-releases.sh [ROLLBACK_RELEASE_DIR]
set -uo pipefail
releases=${CSWORK_RELEASES:-/srv/cswork/releases}
live=$(readlink -f "${CSWORK_CURRENT:-/srv/cswork/current}" 2>/dev/null || true)
# GNU readlink -f succeeds on a missing link, so the live release must be a real releases/<sha> directory.
[[ -n $live && -d $live && $(readlink -f "${live%/*}") == $(readlink -f "$releases") ]] ||
  { echo 'prune skipped: no live release under releases/'; exit 0; }
rollback=$(readlink -f "${1:-}" 2>/dev/null || true)
for old in "$releases"/*; do
  name=${old##*/}
  # Only real <sha> directories; anything else in there was put by hand and stays.
  [[ $name =~ ^[a-f0-9]{40}$ && -d $old && ! -L $old ]] || continue
  real=$(readlink -f "$old")
  [[ $real == "$live" || $real == "$rollback" ]] && continue
  if rm -rf -- "$old"; then echo "pruned release $name"; else echo "warning: could not prune $old"; fi
done
exit 0
