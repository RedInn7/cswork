#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
[[ $(uname -m) == aarch64 ]] || { echo 'This locked deployment targets Linux ARM64.' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
install -d -m 0755 /opt/cswork/runtime /srv/cswork/oj
install -d -m 0700 /etc/cswork
if [[ ! -f /etc/cswork/oj.env ]]; then
  umask 077
  runner_token=$(openssl rand -hex 32)
  redis_password=$(openssl rand -hex 32)
  {
    printf 'GO_JUDGE_URL=http://127.0.0.1:5050\nGO_JUDGE_TOKEN=%s\n' "$runner_token"
    printf 'REDIS_PASSWORD=%s\n' "$redis_password"
    printf 'REDIS_URL=redis://default:%s@127.0.0.1:6381/0\n' "$redis_password"
  } > /etc/cswork/oj.env
fi
chmod 0600 /etc/cswork/oj.env
if [[ ! -x /opt/cswork/runtime/docker-compose ]]; then
  compose_tmp=$(mktemp -d)
  trap 'rm -rf "$compose_tmp"' EXIT
  curl -fsSL https://github.com/docker/compose/releases/download/v5.5.1/docker-compose-linux-aarch64 -o "$compose_tmp/docker-compose"
  printf '732e3a84c1a0f67256ce80bc2598a24546b10ca05f9faa97efceb1171ece2ef7  %s\n' "$compose_tmp/docker-compose" | sha256sum -c -
  install -m 0755 "$compose_tmp/docker-compose" /opt/cswork/runtime/docker-compose
fi
if [[ "$source_dir" != /srv/cswork/oj ]]; then
  cp -a "$source_dir/." /srv/cswork/oj/
fi
cd /srv/cswork/oj
python3 configure-seccomp.py
# The classic builder accepts a hard CPU quota for every build step. The Go
# compiler also uses two jobs/GOMAXPROCS=2, keeping this shared host responsive.
DOCKER_BUILDKIT=0 docker build --cpu-period 100000 --cpu-quota 200000 --memory 2g \
  --tag cswork-go-judge:1.12.3-seccomp .
/opt/cswork/runtime/docker-compose --env-file /etc/cswork/oj.env up -d
echo 'cswork OJ containers started. Run verify-runtime.py before enabling submissions.'
