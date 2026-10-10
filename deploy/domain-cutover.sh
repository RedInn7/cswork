#!/usr/bin/env bash
# Staged move to cswork.org. The temporary sslip domain keeps serving until `switch`,
# and stays configured (names + certificate) so `rollback` is one command.
#   sudo bash /srv/cswork/current/deploy/domain-cutover.sh status|prepare|cert|switch|rollback
#   prepare   nginx answers cswork.org/www (HTTP + ACME); no DNS needed, no restart
#   cert      after DNS points here: expand the cswork certificate to all three names
#   switch    after OAuth callbacks are registered: APP_URL=https://cswork.org, others 301 to it
#   rollback  APP_URL back to the temporary domain, redirect removed
set -euo pipefail
apex=cswork.org www=www.cswork.org temp=cswork.192.18.137.70.sslip.io ip=192.18.137.70
vhost=/etc/nginx/sites-available/cswork env=/etc/cswork/cswork.env
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ $EUID -eq 0 ]] || { echo 'Run as root (sudo).'; exit 2; }
stamp=$(date +%Y%m%d%H%M%S)

edit_nginx() {
  cp -p "$vhost" "$vhost.before-$stamp"
  python3 "$here/configure-nginx.py" "$vhost" "$@"
  if ! nginx -t 2>/dev/null; then
    cp -p "$vhost.before-$stamp" "$vhost"
    echo 'nginx rejected the change; previous config restored, nginx untouched.'
    exit 1
  fi
  systemctl reload nginx
}

cert_names() {
  openssl x509 -in /etc/letsencrypt/live/cswork/fullchain.pem -noout -ext subjectAltName |
    grep -o 'DNS:[^,]*' | sed 's/DNS://' | tr '\n' ' '
}

set_app_url() {
  local previous
  previous=$(grep -E '^APP_URL=' "$env" | cut -d= -f2-)
  cp -p "$env" "$env.before-$stamp"
  sed -i "s#^APP_URL=.*#APP_URL=$1#" "$env"
  systemctl restart cswork
  for _ in $(seq 60); do
    curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:4317/api/bootstrap && { echo "APP_URL=$1 (was $previous)"; return; }
    sleep 1
  done
  cp -p "$env.before-$stamp" "$env"
  systemctl restart cswork
  echo "App unhealthy with APP_URL=$1; restored $previous."
  return 1
}

case ${1:-status} in
  status)
    for host in $apex $www; do echo "DNS $host -> $(dig +short @1.1.1.1 A "$host" | tr '\n' ' ')"; done
    echo "certificate: $(cert_names)"
    openssl x509 -in /etc/letsencrypt/live/cswork/fullchain.pem -noout -enddate
    grep -E 'server_name|cswork-canonical' "$vhost"
    grep -E '^APP_URL=' "$env"
    for host in $temp $apex $www; do
      printf '%s https -> ' "$host"
      curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' --max-time 5 --resolve "$host:443:127.0.0.1" "https://$host/api/bootstrap" -k
    done ;;
  prepare)
    edit_nginx --names $temp $apex $www
    echo "nginx now answers $apex and $www; the temporary domain is unchanged." ;;
  cert)
    for host in $apex $www; do
      answer=$(dig +short @1.1.1.1 A "$host" | grep -E '^[0-9.]+$' | sort -u | tr '\n' ' ')
      [[ "$answer" == "$ip " ]] || { echo "$host resolves to '$answer', expected only $ip. Finish DNS first."; exit 1; }
    done
    certbot certonly --non-interactive --agree-tos --webroot -w /var/www/cswork-acme \
      --cert-name cswork --expand -d $temp -d $apex -d $www --email capsfly7@gmail.com
    systemctl reload nginx
    echo "certificate: $(cert_names)" ;;
  switch)
    names=$(cert_names)
    [[ " $names" == *" $apex "* && " $names" == *" $www "* ]] || { echo "Certificate lacks $apex/$www; run cert first."; exit 1; }
    edit_nginx --canonical $apex
    set_app_url "https://$apex" || { edit_nginx --canonical -; exit 1; }
    echo "Live on https://$apex; $www and $temp redirect there. Undo: domain-cutover.sh rollback" ;;
  rollback)
    edit_nginx --canonical -
    set_app_url "https://$temp" || exit 1
    echo "Back on https://$temp; $apex/$www stay configured." ;;
  *) echo "usage: $0 status|prepare|cert|switch|rollback"; exit 2 ;;
esac
