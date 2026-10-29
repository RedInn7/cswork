#!/bin/sh
# Class-data-sharing archives for javac's JVM and the learner's JVM, built from
# training runs of the programs in $1 (deploy/oj/java-cds). Only JDK classes
# are archived: learner classes differ every run and still load from main.jar.
# Sandboxes read the archives through /usr's read-only mount; a JVM given a
# missing archive path starts silently without it, so commands may always name
# them. Rebuild whenever the JDK changes (an archive from another JDK build is
# ignored, so the cost is speed, not correctness).
set -eu
src=$1
out=/usr/local/lib/cswork/java-cds-v1
work=$(mktemp -d)
for program in acm leetcode; do
  mkdir "$work/$program"
  cp "$src/$program/Main.java" "$work/$program/"
  (cd "$work/$program" &&
    /usr/bin/javac -J-Xshare:off -J-XX:DumpLoadedClassList=../javac-$program.classlist -encoding UTF-8 Main.java &&
    /usr/bin/java -Xshare:off -XX:DumpLoadedClassList=../run-$program.classlist -cp . Main < "$src/$program/input.txt" > /dev/null)
done
# JDK classes and their lambda forms; ids only matter for custom loaders. The
# JDK's own default classlist keeps everything its stock archive already shares.
classlist=$(dirname "$(dirname "$(readlink -f /usr/bin/java)")")/lib/classlist
test -r "$classlist"
jdk() {
  grep -hE '^((java|javax|jdk|sun|com/sun)/|@lambda-form-invoker |@lambda-proxy (java|javax|jdk|sun|com/sun)/)' "$@" |
    sed 's/ id: [0-9]*$//' | awk '!seen[$0]++'
}
mkdir "$work/empty"
cd "$work/empty"
mkdir -p "$out.tmp"
for archive in javac run; do
  jdk "$classlist" "$work"/$archive-*.classlist > "$work/$archive.classlist"
  # G1 at dump time also archives heap objects; runs may use any GC.
  /usr/bin/java -Xshare:dump -XX:+UseG1GC -XX:SharedClassListFile="$work/$archive.classlist" \
    -XX:SharedArchiveFile="$out.tmp/$archive.jsa" > /dev/null
done
# -Xshare:on fails unless the archive maps, with the judge's own flags.
cd "$work/acm"
/usr/bin/javac -J-Xshare:on -J-XX:SharedArchiveFile="$out.tmp/javac.jsa" -J-XX:TieredStopAtLevel=1 -J-XX:+UseSerialGC -encoding UTF-8 Main.java
/usr/bin/java -Xshare:on -XX:SharedArchiveFile="$out.tmp/run.jsa" -Xmx153m -Xss64m -XX:ReservedCodeCacheSize=32m \
  -XX:MaxMetaspaceSize=64m -XX:ActiveProcessorCount=1 -cp . Main < "$src/acm/input.txt" > /dev/null
chmod 0444 "$out.tmp"/*.jsa
chmod 0555 "$out.tmp"
# Renamed last: a failed build never leaves a half-made archive at the real path.
mv "$out.tmp" "$out"
rm -r "$work"
