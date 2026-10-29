#!/bin/sh
set -eu
# Build only trusted standard-library headers with exactly the submission flags.
# /usr is mounted read-only in every sandbox; submissions cannot alter this file.
mkdir -p /usr/local/include/cswork/pch
printf '#include <bits/stdc++.h>\n' > /usr/local/include/cswork/stdc++.hpp
g++ -std=c++20 -O2 -pipe -x c++-header \
  /usr/local/include/cswork/stdc++.hpp \
  -o /usr/local/include/cswork/stdc++.hpp.gch
chmod 0444 /usr/local/include/cswork/stdc++.hpp /usr/local/include/cswork/stdc++.hpp.gch
# Header sets for sources that include standard headers one by one; keep in
# sync with STD_HEADER_PCHS in lib/server/oj-engine.ts.
for set in iostream-vector-algorithm iostream-vector vector-algorithm iostream; do
  header=/usr/local/include/cswork/pch/$set.hpp
  for name in $(echo "$set" | tr - ' '); do printf '#include <%s>\n' "$name"; done > "$header"
  g++ -std=c++20 -O2 -pipe -x c++-header "$header" -o "$header.gch"
  chmod 0444 "$header" "$header.gch"
done
