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
install -d -m 2750 -o cswork -g www-data /srv/cswork/media
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

# Only the independent media directory is readable by nginx; database/attachments
# remain private. Existing external Stream settings, if any, are preserved.
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/cswork/cswork.env')
lines=p.read_text().splitlines()
keys={line.split('=',1)[0] for line in lines}
for key,value in [('MEDIA_PATH','/srv/cswork/media'),('MEDIA_X_ACCEL_PREFIX','/__cswork_media/'),('MEDIA_MAX_BYTES','10737418240'),('ATTACHMENTS_MAX_BYTES','1073741824')]:
    if key not in keys: lines.append(key+'='+value)
p.write_text('\n'.join(lines)+'\n')
p.chmod(0o640)
PY
chown root:cswork /etc/cswork/cswork.env

# Only the OJ worker receives execution credentials. The web process needs configuration
# for admission and reads health from SQLite; credentials are never returned by an API.
if [[ -f /etc/cswork/oj.env ]]; then
  python3 - <<'PY'
from pathlib import Path
p=Path('/etc/cswork/cswork.env')
keys={'GO_JUDGE_URL','GO_JUDGE_TOKEN','REDIS_URL','OJ_LANGUAGE_VERSIONS','OJ_ENABLED'}
existing=[line for line in p.read_text().splitlines() if line.split('=',1)[0] not in keys]
p.write_text('\n'.join(existing+['OJ_ENABLED=true'])+'\n')
p.chmod(0o640)
PY
  chown root:cswork /etc/cswork/cswork.env
fi

# Take an online SQLite backup before applying future migrations.
if [[ -f /var/lib/cswork/cswork.sqlite ]]; then
  cd "$source_dir"
  "$node_binary" --env-file=/etc/cswork/cswork.env scripts/backup.mjs
  # The installer runs as root; the daily timer runs as cswork. Preserve media
  # inode groups because backup objects may be hard links read by nginx.
  chown -R cswork /var/lib/cswork/backups
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
worker_was_active=$(systemctl is-active cswork-oj-worker.service || true)
if [[ "$worker_was_active" == active ]]; then systemctl stop cswork-oj-worker.service; fi
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
    if [[ -f "$previous/oj-worker/index.mjs" ]]; then systemctl restart cswork-oj-worker.service; fi
  else
    systemctl stop cswork.service
  fi
  echo 'cswork failed its startup check; previous release restored when available.'
  exit 1
fi

if [[ -f "$target/oj-worker/index.mjs" && -f /etc/cswork/oj.env ]]; then
  install -m 644 "$source_dir/deploy/cswork-oj-worker.service" /etc/systemd/system/cswork-oj-worker.service
  systemctl daemon-reload
  systemctl enable cswork-oj-worker.service
  worker_started_at=$(date +%s)000
  worker_ready=false
  if systemctl restart cswork-oj-worker.service; then
    for attempt in {1..30}; do
      if systemctl is-active --quiet cswork-oj-worker.service && WORKER_STARTED_AT="$worker_started_at" "$node_binary" --env-file=/etc/cswork/cswork.env --input-type=module -e 'import Database from "better-sqlite3"; const db=new Database(process.env.DATABASE_PATH,{readonly:true}); const r=db.prepare("SELECT healthy,heartbeat_at FROM oj_runtime WHERE id=?").get("worker"); db.close(); process.exit(r?.healthy && r.heartbeat_at>=Number(process.env.WORKER_STARTED_AT) && Date.now()-r.heartbeat_at<15000 ? 0 : 1)'; then
        worker_ready=true; break
      fi
      sleep 1
    done
  fi
  if [[ "$worker_ready" != true ]]; then
    systemctl stop cswork-oj-worker.service
    if [[ -n "$previous" ]]; then
      ln -s "$previous" /srv/cswork/current.rollback
      mv -Tf /srv/cswork/current.rollback /srv/cswork/current
      systemctl restart cswork.service
      if [[ -f "$previous/oj-worker/index.mjs" ]]; then systemctl restart cswork-oj-worker.service; fi
    fi
    echo 'OJ worker health check failed; previous application release restored.'
    exit 1
  fi
fi

# Existing certificate configuration is retained on later releases.
install -m 644 "$source_dir/deploy/nginx-media.conf" /etc/nginx/snippets/cswork-media.conf
created_config=false
if [[ ! -f /etc/nginx/sites-available/cswork ]]; then
  sed "s/CSWORK_HOSTNAME/$domain/g" "$source_dir/deploy/nginx.conf.template" > /etc/nginx/sites-available/cswork
  created_config=true
fi
# Teacher problem imports accept at most 8 MiB plus a small JSON envelope.
# Attachment and all other application limits remain enforced in their own handlers.
sed -i 's/client_max_body_size 3m;/client_max_body_size 9m;/' /etc/nginx/sites-available/cswork
python3 "$source_dir/deploy/configure-nginx.py" /etc/nginx/sites-available/cswork
created_link=false
if [[ ! -e /etc/nginx/sites-enabled/cswork ]]; then
  ln -s /etc/nginx/sites-available/cswork /etc/nginx/sites-enabled/cswork
  created_link=true
fi
if ! nginx -t; then
  if [[ "$created_link" == true ]]; then unlink /etc/nginx/sites-enabled/cswork; fi
  if [[ "$created_config" == true ]]; then unlink /etc/nginx/sites-available/cswork; fi
  echo 'cswork nginx entry failed validation; existing nginx stays running.'
  exit 1
fi
systemctl reload nginx
install -m 644 "$source_dir/deploy/cswork-backup.service" /etc/systemd/system/cswork-backup.service
install -m 644 "$source_dir/deploy/cswork-backup.timer" /etc/systemd/system/cswork-backup.timer
systemctl daemon-reload
systemctl enable --now cswork-backup.timer
echo "cswork release $release is running. Issue/verify TLS before sharing https://$domain."
