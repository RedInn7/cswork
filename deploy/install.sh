#!/usr/bin/env bash
set -euo pipefail
release=${1:?Pass the source commit SHA}
domain=${2:?Pass the independent hostname}
node_binary=${3:?Pass the installed Node 22+ binary}
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$domain" =~ ^[a-z0-9][a-z0-9.-]+[a-z0-9]$ ]] || exit 2
[[ $EUID -eq 0 ]] || { echo 'Run install.sh through sudo'; exit 2; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
test -f "$source_dir/dist/standalone/server.js"
test -x "$node_binary"
nginx -t

id cswork >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/cswork --shell /usr/sbin/nologin cswork
install -d -m 755 /srv/cswork/releases /opt/cswork/runtime /var/www/cswork-acme
install -d -m 700 -o cswork -g cswork /var/lib/cswork /var/lib/cswork/attachments /var/lib/cswork/backups
install -d -m 750 -o root -g cswork /etc/cswork
install -m 755 "$node_binary" /opt/cswork/runtime/node.next
mv -f /opt/cswork/runtime/node.next /opt/cswork/runtime/node

if [[ ! -f /etc/cswork/cswork.env ]]; then
  domain="$domain" python3 - <<'PY'
import os, secrets
p='/etc/cswork/cswork.env'
with open(p,'x') as f:
    f.write('NODE_ENV=production\nHOST=127.0.0.1\nPORT=4317\n')
    f.write('APP_URL=https://'+os.environ['domain']+'\n')
    f.write('ADMIN_EMAILS=capsfly7@gmail.com\n')
    f.write('BETTER_AUTH_SECRET='+secrets.token_urlsafe(48)+'\n')
    f.write('DATABASE_PATH=/var/lib/cswork/cswork.sqlite\nATTACHMENTS_PATH=/var/lib/cswork/attachments\n')
    f.write('CSWORK_ADMIN_PASSWORD_FILE=/var/lib/cswork/initial-login.txt\n')
os.chmod(p,0o640)
PY
  chown root:cswork /etc/cswork/cswork.env
fi

# Take an online SQLite backup before applying future migrations.
if [[ -f /var/lib/cswork/cswork.sqlite ]]; then
  cd "$source_dir"
  "$node_binary" --env-file=/etc/cswork/cswork.env scripts/backup.mjs
fi
cd "$source_dir"
"$node_binary" --env-file=/etc/cswork/cswork.env scripts/migrate.mjs
chown cswork:cswork /var/lib/cswork/cswork.sqlite*

target="/srv/cswork/releases/$release"
if [[ ! -d "$target" ]]; then
  cp -a "$source_dir/dist/standalone" "$target"
  install -d -m 755 "$target/scripts"
  install -m 644 "$source_dir/scripts/backup.mjs" "$target/scripts/backup.mjs"
  printf '%s\n' "$release" > "$target/REVISION"
  chown -R root:root "$target"
  chmod -R a+rX "$target"
fi
previous=$(readlink -f /srv/cswork/current || true)
ln -s "$target" /srv/cswork/current.next
mv -Tf /srv/cswork/current.next /srv/cswork/current
install -m 644 "$source_dir/deploy/cswork.service" /etc/systemd/system/cswork.service
systemctl daemon-reload
systemctl enable cswork.service
ready=false
if systemctl restart cswork.service; then
  for attempt in {1..20}; do
    if curl -fsS --connect-timeout 2 --max-time 3 http://127.0.0.1:4317/api/bootstrap | python3 -c 'import json,sys; result=json.load(sys.stdin); assert result["courses"] and result["services"]["password"]'; then
      ready=true
      break
    fi
    sleep 1
  done
fi
if [[ "$ready" != true ]]; then
  if [[ -n "$previous" ]]; then
    ln -s "$previous" /srv/cswork/current.rollback
    mv -Tf /srv/cswork/current.rollback /srv/cswork/current
    systemctl restart cswork.service
  else
    systemctl stop cswork.service
  fi
  echo 'cswork failed its startup check; previous release restored when available.'
  exit 1
fi

# Existing certificate configuration is retained on later releases.
if [[ ! -f /etc/nginx/sites-available/cswork ]]; then
  sed "s/CSWORK_HOSTNAME/$domain/g" "$source_dir/deploy/nginx.conf.template" > /etc/nginx/sites-available/cswork
  ln -s /etc/nginx/sites-available/cswork /etc/nginx/sites-enabled/cswork
  if ! nginx -t; then
    unlink /etc/nginx/sites-enabled/cswork
    echo 'cswork nginx entry failed validation; existing nginx stays running.'
    exit 1
  fi
systemctl reload nginx
fi
install -m 644 "$source_dir/deploy/cswork-backup.service" /etc/systemd/system/cswork-backup.service
install -m 644 "$source_dir/deploy/cswork-backup.timer" /etc/systemd/system/cswork-backup.timer
systemctl daemon-reload
systemctl enable --now cswork-backup.timer
echo "cswork release $release is running. Issue/verify TLS before sharing https://$domain."
