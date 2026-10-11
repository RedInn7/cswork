#!/usr/bin/env bash
# Publishes the built content library and its images to the server. The app swaps to the new file
# within 30 s (no restart); images are content-addressed, so existing ones are never overwritten.
#   bash scripts/content-import/prachub/publish.sh [ubuntu@192.18.137.70]
set -euo pipefail
host=${1:-ubuntu@192.18.137.70}
dir=${PRACHUB_DIR:-$HOME/cswork-prachub}
test -s "$dir/content.sqlite"
mkdir -p "$dir/assets"
rsync -az "$dir/assets/" "$host:/tmp/cswork-content-assets/"
rsync -az "$dir/content.sqlite" "$host:/tmp/cswork-content.sqlite"
ssh "$host" 'set -e
  sudo install -d -m 2750 -o cswork -g www-data /srv/cswork/content-assets
  sudo rsync -a --chown=cswork:www-data --chmod=D2750,F640 /tmp/cswork-content-assets/ /srv/cswork/content-assets/
  sudo install -m 640 -o cswork -g cswork /tmp/cswork-content.sqlite /var/lib/cswork/content.sqlite.new
  sudo mv /var/lib/cswork/content.sqlite.new /var/lib/cswork/content.sqlite
  rm -rf /tmp/cswork-content-assets /tmp/cswork-content.sqlite
  sudo du -sh /var/lib/cswork/content.sqlite /srv/cswork/content-assets'
