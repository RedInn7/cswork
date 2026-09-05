#!/usr/bin/env bash
set -euo pipefail
domain=${1:?Pass the independent hostname}
[[ "$domain" =~ ^[a-z0-9][a-z0-9.-]+[a-z0-9]$ ]] || exit 2
[[ $EUID -eq 0 ]] || exit 2
test -f /etc/nginx/sites-available/cswork
certbot certonly --non-interactive --agree-tos --webroot -w /var/www/cswork-acme --cert-name cswork -d "$domain" --email capsfly7@gmail.com
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cp /etc/nginx/sites-available/cswork /etc/nginx/sites-available/cswork.before-tls
python3 - "$source_dir/deploy/nginx.conf.template" "$domain" <<'PY'
import sys
template=open(sys.argv[1]).read().replace('CSWORK_HOSTNAME',sys.argv[2])
tls=template.replace('listen 80;', '''listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/cswork/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cswork/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;''')
redirect='''server {
    listen 80;
    server_name %s;
    location ^~ /.well-known/acme-challenge/ { root /var/www/cswork-acme; }
    location / { return 301 https://$host$request_uri; }
}
''' % sys.argv[2]
open('/etc/nginx/sites-available/cswork','w').write(redirect+tls)
PY
if ! nginx -t; then
  mv /etc/nginx/sites-available/cswork.before-tls /etc/nginx/sites-available/cswork
  exit 1
fi
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/cswork-nginx.sh <<'SH'
#!/bin/sh
if [ "${RENEWED_LINEAGE##*/}" = cswork ]; then
  nginx -t && systemctl reload nginx
fi
SH
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/cswork-nginx.sh
echo "cswork HTTPS ready: https://$domain"
