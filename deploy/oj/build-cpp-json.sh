#!/bin/sh
set -eu
# The header and archive are installed together from the same immutable ABI source.
# Keep these flags identical to submissions; /usr is read-only inside the sandbox.
source_dir=${1:?Usage: build-cpp-json.sh source-directory}
mkdir -p /usr/local/include/cswork /usr/local/lib/cswork
install -m 0444 "$source_dir/json-runtime.hpp" /usr/local/include/cswork/json-v1.hpp
g++ -std=c++20 -O2 -pipe -c "$source_dir/json-runtime.cpp" -o /tmp/cswork-json-v1.o
ar rcs /usr/local/lib/cswork/libjson-v1.a /tmp/cswork-json-v1.o
chmod 0444 /usr/local/lib/cswork/libjson-v1.a
rm /tmp/cswork-json-v1.o
