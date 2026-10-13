#!/usr/bin/env bash
# cswork-notify <message>: POST the message as plain text to NOTIFY_URL from /etc/cswork/cswork.env
# (an ntfy topic URL such as https://ntfy.sh/<secret-topic>, or any webhook taking a text body).
set -uo pipefail
message="$*"
url=$(sed -n 's/^NOTIFY_URL=//p' /etc/cswork/cswork.env 2>/dev/null | tail -n 1)
if [[ -z "$url" ]]; then
  echo "NOTIFY_URL unset; not sent: $message"
  exit 0
fi
# ponytail: text body only; Slack/Discord-style JSON webhooks need a relay such as ntfy.
curl -fsS --max-time 15 --retry 2 -H 'Title: cswork' -H 'Content-Type: text/plain; charset=utf-8' \
  --data-binary "$message" "$url" >/dev/null || { echo "notify failed: $message" >&2; exit 1; }
echo "notified: $message"
