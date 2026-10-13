#!/usr/bin/env bash
# Idempotent; releases ship it: sudo bash /srv/cswork/current/deploy/monitor/install.sh
# Alerts go to NOTIFY_URL in /etc/cswork/cswork.env (e.g. https://ntfy.sh/<secret-topic>); unset = journal only.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run install.sh through sudo'; exit 2; }
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
install -m 755 "$here/notify.sh" /usr/local/bin/cswork-notify
install -m 755 "$here/watch.sh" /usr/local/bin/cswork-watch
install -m 644 "$here/cswork-notify@.service" "$here/cswork-watch.service" "$here/cswork-watch.timer" /etc/systemd/system/
# go-judge runs as a Docker container, not a unit; the worker reports it through /api/health.
for unit in cswork.service cswork-oj-worker.service cswork-backup.service cswork-language-service.service; do
  systemctl cat "$unit" >/dev/null 2>&1 || { echo "skip $unit (not installed)"; continue; }
  install -d -m 755 "/etc/systemd/system/$unit.d"
  printf '[Unit]\nOnFailure=cswork-notify@%%n.service\n' > "/etc/systemd/system/$unit.d/notify.conf"
done
systemctl daemon-reload
systemctl enable --now cswork-watch.timer
grep -q '^NOTIFY_URL=.' /etc/cswork/cswork.env 2>/dev/null ||
  echo 'NOTIFY_URL is not set in /etc/cswork/cswork.env; alerts are only logged.'
