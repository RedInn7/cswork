#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" != 0 ]; then echo 'Run as root' >&2; exit 1; fi
task_root="$(cd "$(dirname "$0")/../.." && pwd)"
image=cswork-language-service:1
docker image inspect "$image" >/dev/null
test -x /opt/cswork/runtime/node
test -f "$task_root/node_modules/vscode-jsonrpc/package.json"
test -f /etc/cswork/cswork.env
task_backup="$(mktemp -d /var/tmp/cswork-lsp-install.XXXXXX)"
was_active=false
systemctl is-active --quiet cswork-language-service.service && was_active=true
if [ -d /srv/cswork-language-service ]; then cp -a /srv/cswork-language-service "$task_backup/runtime"; fi
if [ -f /etc/systemd/system/cswork-language-service.service ]; then cp -a /etc/systemd/system/cswork-language-service.service "$task_backup/unit"; fi
cp -a /etc/cswork/cswork.env "$task_backup/web.env"
rollback() {
  set +e
  systemctl stop cswork-language-service.service
  if [ -d "$task_backup/runtime" ]; then
    rm -rf /srv/cswork-language-service
    cp -a "$task_backup/runtime" /srv/cswork-language-service
  fi
  if [ -f "$task_backup/unit" ]; then cp -a "$task_backup/unit" /etc/systemd/system/cswork-language-service.service; fi
  cp -a "$task_backup/web.env" /etc/cswork/cswork.env
  systemctl daemon-reload
  if [ "$was_active" = true ]; then systemctl start cswork-language-service.service; fi
  rm -rf "$task_backup"
  echo 'Language service health failed; previous scripts and web configuration restored. Shared token was not rotated.' >&2
  exit 1
}
trap rollback ERR
id cswork-lsp >/dev/null 2>&1 || useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin cswork-lsp
usermod -aG docker cswork-lsp
install -d -m 0755 /srv/cswork-language-service/scripts/language-service
install -m 0644 "$task_root"/scripts/language-service/*.mjs /srv/cswork-language-service/scripts/language-service/
install -d -m 0755 /srv/cswork-language-service/node_modules
cp -R "$task_root/node_modules/vscode-jsonrpc" /srv/cswork-language-service/node_modules/
chown -R root:root /srv/cswork-language-service
install -d -m 0750 -o root -g cswork /etc/cswork
if [ ! -f /etc/cswork/language-service.env ]; then
  umask 077
  printf 'CSWORK_LSP_TOKEN=%s\nCSWORK_LSP_IMAGE=%s\nCSWORK_LSP_PORT=4321\n' "$(openssl rand -hex 32)" "$image" > /etc/cswork/language-service.env
fi
chmod 0600 /etc/cswork/language-service.env
install -m 0644 "$task_root/deploy/language-service/cswork-language-service.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable cswork-language-service.service
systemctl restart cswork-language-service.service
python3 - <<'PY'
import pathlib, urllib.request, json, time, os, grp
secret = pathlib.Path('/etc/cswork/language-service.env')
values = dict(line.split('=', 1) for line in secret.read_text().splitlines() if '=' in line and not line.startswith('#'))
token = values['CSWORK_LSP_TOKEN']
for attempt in range(30):
    try:
        req = urllib.request.Request('http://127.0.0.1:4321/health', headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(req, timeout=2) as res:
            assert json.load(res)['ok'] is True
        break
    except Exception:
        if attempt == 29: raise RuntimeError('Broker health check failed') from None
        time.sleep(1)
web = pathlib.Path('/etc/cswork/cswork.env')
patch = {'CSWORK_LSP_TOKEN': token, 'CSWORK_LSP_URL': 'http://127.0.0.1:4321'}
lines = [line for line in web.read_text().splitlines() if line.split('=', 1)[0] not in patch]
lines.extend(key + '=' + value for key, value in patch.items())
temp = web.with_name('cswork.env.lsp-new')
fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as output: output.write('\n'.join(lines) + '\n')
os.chown(temp, 0, grp.getgrnam('cswork').gr_gid)
os.chmod(temp, 0o640)
os.replace(temp, web)
print('Broker healthy; private token/URL saved to web environment without restarting the web app.')
PY
trap - ERR
rm -rf "$task_backup"
