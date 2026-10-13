#!/usr/bin/env bash
# Gzip and server_tokens for every site on this nginx; cswork's HSTS/X-Frame-Options,
# own access log and /api rate limits. Idempotent. Each file it writes is backed up
# first and restored, nginx not reloaded, unless nginx -t accepts the result.
#   sudo bash /srv/cswork/current/deploy/apply-nginx-hardening.sh
#   sudo bash /srv/cswork/current/deploy/apply-nginx-hardening.sh undo STAMP
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root (sudo).'; exit 2; }
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
vhost=/etc/nginx/sites-available/cswork
files=(/etc/nginx/conf.d/cswork-http.conf /etc/nginx/snippets/cswork-server.conf
  /etc/nginx/snippets/cswork-oj-import.conf "$vhost")
stamp=$(date +%Y%m%d%H%M%S)

# A file without a backup did not exist before this run.
restore() {
  for f in "${files[@]}"; do
    if [[ -e "$f.before-$stamp" ]]; then cp -p "$f.before-$stamp" "$f"; else rm -f "$f"; fi
  done
}

if [[ ${1:-} == undo ]]; then
  stamp=${2:?Pass the STAMP printed by the run to undo}
  test -e "$vhost.before-$stamp"
  restore
  nginx -t
  systemctl reload nginx
  echo "Restored the nginx files from before-$stamp."
  exit
fi

test -f "$vhost"
nginx -t 2>/dev/null || { echo 'nginx -t already fails; fix that first.'; exit 1; }
for f in "${files[@]}"; do
  if [[ -e "$f" ]]; then cp -p "$f" "$f.before-$stamp"; fi
done
applied=false
trap '[[ $applied == true ]] || { restore; echo "Not applied: previous nginx files restored, nginx not reloaded."; }' EXIT
install -m 644 "$here/nginx-http.conf" /etc/nginx/conf.d/cswork-http.conf
install -m 644 "$here/nginx-server.conf" /etc/nginx/snippets/cswork-server.conf
install -m 644 "$here/nginx-oj-import.conf" /etc/nginx/snippets/cswork-oj-import.conf
python3 "$here/configure-nginx.py" "$vhost"
nginx -t
applied=true
systemctl reload nginx
echo "Applied. Undo: sudo bash $here/apply-nginx-hardening.sh undo $stamp"

# reload is asynchronous: old workers answer for a moment.
sleep 2
check() { curl -s -o /dev/null -D - --max-time 5 -H 'Accept-Encoding: gzip' --resolve cswork.org:443:127.0.0.1 "https://cswork.org$1"; }
check / | grep -i -E '^(server|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy):' || true
js=$(curl -s --max-time 5 --resolve cswork.org:443:127.0.0.1 https://cswork.org/ | grep -o '/_next/static/chunks/[^"]*\.js' | head -1 || true)
[[ -z $js ]] || { printf '%s ' "$js"; check "$js" | grep -i '^content-encoding:' || echo 'NOT compressed'; }
tail -n 1 /var/log/nginx/cswork.access.log 2>/dev/null || true
