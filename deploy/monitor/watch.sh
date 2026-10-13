#!/usr/bin/env bash
# Every 5 minutes (cswork-watch.timer): app health, root disk, TLS expiry.
# One notification per problem per 6h; a recovery message when it clears.
set -u
domain=cswork.org
state=${STATE_DIRECTORY:-/var/lib/cswork-watch}
host=$(hostname)

problem() {
  # find prints the marker only if it was touched within the last 6h.
  [[ -n $(find "$state/$1" -mmin -360 2>/dev/null) ]] && return
  cswork-notify "$2" && touch "$state/$1"
}
fine() {
  [[ -e "$state/$1" ]] || return 0
  rm -f "$state/$1"
  cswork-notify "$1 recovered on $host"
}

if out=$(curl -sS --fail-with-body --max-time 10 http://127.0.0.1:4317/api/health 2>&1); then fine health
else problem health "cswork health failing on $host: $out"; fi

used=$(df --output=pcent / | tail -n 1 | tr -dc 0-9)
if (( ${used:-0} > 85 )); then problem disk "root disk ${used}% full on $host"
else fine disk; fi

end=$(timeout 20 openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null |
  openssl x509 -noout -enddate -checkend $((14 * 86400)) 2>/dev/null)
if [[ $? -eq 0 ]]; then fine tls
else problem tls "TLS for $domain expires within 14 days or is unreachable (${end:-no certificate})"; fi
