#!/bin/sh
set -eu
# Build only trusted standard-library headers with exactly the submission flags.
# /usr is mounted read-only in every sandbox; submissions cannot alter this file.
mkdir -p /usr/local/include/cswork
printf '#include <bits/stdc++.h>\n' > /usr/local/include/cswork/stdc++.hpp
g++ -std=c++20 -O2 -pipe -x c++-header \
  /usr/local/include/cswork/stdc++.hpp \
  -o /usr/local/include/cswork/stdc++.hpp.gch
chmod 0444 /usr/local/include/cswork/stdc++.hpp /usr/local/include/cswork/stdc++.hpp.gch
