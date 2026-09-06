#!/bin/sh
# Only trusted standard-library packages are cached. Sandboxes read this cache
# through /usr's read-only mount; user-package cache misses remain private work.
set -eu
cache=/usr/local/lib/cswork/go-stdlib-cache-v1
mkdir -p "$cache"
export GOCACHE="$cache"
export CGO_ENABLED=0 GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOMAXPROCS=2
/usr/bin/go build -trimpath std
# Written last: a failed/incomplete image build must not advertise a usable cache.
{
  /usr/bin/go version
  /usr/bin/go env -json GOOS GOARCH GOVERSION CGO_ENABLED GOTOOLCHAIN
  printf '%s\n' 'build=go build -trimpath std' 'GOMAXPROCS=2' 'GOPROXY=off' 'GOSUMDB=off'
} > "$cache/cswork-toolchain-v1"
find "$cache" -type f -exec chmod 0444 {} +
find "$cache" -type d -exec chmod 0555 {} +
