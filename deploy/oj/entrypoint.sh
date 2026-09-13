#!/bin/sh
set -eu
OJ_RUNNER_PARALLELISM=${OJ_RUNNER_PARALLELISM:-4}
case "$OJ_RUNNER_PARALLELISM" in
  1|2|4) ;;
  *) printf '%s\n' 'OJ_RUNNER_PARALLELISM must be 1, 2, or 4' >&2; exit 64 ;;
esac
# Docker's private cgroup namespace scopes this filesystem to this container.
# Never bind the host cgroup root or use host cgroup/pid/network namespaces.
test "$(stat -fc %T /sys/fs/cgroup)" = cgroup2fs
mount -o remount,rw /sys/fs/cgroup
for controller in cpu memory pids; do
  grep -qw "$controller" /sys/fs/cgroup/cgroup.controllers
done
# v1.12.3 rejects an empty cgroup prefix, as reported by a private namespace
# root. Move into an owned child before initialization; all operations remain
# underneath this Docker container's cgroup and never touch sibling services.
mkdir -p /sys/fs/cgroup/cswork
printf '%s\n' "$$" > /sys/fs/cgroup/cswork/cgroup.procs
printf '+cpu +memory +pids\n' > /sys/fs/cgroup/cgroup.subtree_control
exec /opt/go-judge \
  -http-addr=:5050 -no-fallback \
  -parallelism="$OJ_RUNNER_PARALLELISM" -pre-fork="$OJ_RUNNER_PARALLELISM" \
  -net-share=false -container-cred-start=1536 -file-timeout=10m \
  -output-limit=64m -copy-out-limit=64m -open-file-limit=128 \
  -src-prefix=/nonexistent \
  -enable-cpu-rate -mount-conf=/opt/mount.yaml -seccomp-conf=/opt/seccomp.yaml
