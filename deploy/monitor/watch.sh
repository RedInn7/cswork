#!/usr/bin/env bash
# Every 5 minutes (cswork-watch.timer): app health, root disk, TLS expiry.
# At most one alert per problem per 6h; one recovery message after an alerted problem clears.
set -u
domain=cswork.org
state=${STATE_DIRECTORY:-/var/lib/cswork-watch}
host=$(hostname)

# $1.sent: last alert (kept across recoveries, so flapping stays quiet for 6h);
# $1: alerted and not yet recovered, so only an alerted problem reports recovery.
problem() {
  [[ -n $(find "$state/$1.sent" -mmin -360 2>/dev/null) ]] && return
  cswork-notify "$2" && touch "$state/$1.sent" "$state/$1"
}
fine() {
  [[ -e "$state/$1" ]] || return 0
  rm -f "$state/$1"
  cswork-notify "$1 recovered on $host"
}

# Two consecutive failures: a release restarts the app and worker for tens of seconds.
if out=$(curl -sS --fail-with-body --max-time 10 http://127.0.0.1:4317/api/health 2>&1); then
  rm -f "$state/health.fail"; fine health
elif [[ -e "$state/health.fail" ]]; then problem health "cswork health failing on $host: $out"
else touch "$state/health.fail"; fi

used=$(df --output=pcent / | tail -n 1 | tr -dc 0-9)
if (( ${used:-0} > 85 )); then problem disk "root disk ${used}% full on $host"
else fine disk; fi

end=$(timeout 20 openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null |
  openssl x509 -noout -enddate -checkend $((14 * 86400)) 2>/dev/null)
if [[ $? -eq 0 ]]; then fine tls
else problem tls "TLS for $domain expires within 14 days or is unreachable (${end:-no certificate})"; fi
