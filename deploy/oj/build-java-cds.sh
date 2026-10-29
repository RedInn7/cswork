#!/bin/sh
# Class-data-sharing archives for the learner's JVM and javac's JVM, built from
# training runs of the programs in $1 (deploy/oj/java-cds). Only JDK classes
# are archived: learner classes differ every run and still load from main.jar.
# - The learner's archive replaces the JDK's default classes.jsa, so `java`
#   needs no flag and an image without it keeps the stock archive. (A JVM told
#   -XX:SharedArchiveFile=<missing> runs with no archive at all: slower still.)
#   Its class list includes the JDK's own, so nothing the stock archive shared
#   is lost. A JDK package upgrade restores the stock, matching archive.
# - javac's archive is named by the compile command only when it exists.
# Sandboxes read both through /usr's read-only mount.
set -eu
src=$1
out=/usr/local/lib/cswork/java-cds-v1
home=$(dirname "$(dirname "$(readlink -f /usr/bin/java)")")
work=$(mktemp -d)
for program in acm leetcode; do
  mkdir "$work/$program"
  cp "$src/$program/Main.java" "$work/$program/"
  (cd "$work/$program" &&
    /usr/bin/javac -J-Xshare:off -J-XX:DumpLoadedClassList=../javac-$program.classlist -encoding UTF-8 Main.java &&
    /usr/bin/java -Xshare:off -XX:DumpLoadedClassList=../run-$program.classlist -cp . Main < "$src/$program/input.txt" > /dev/null)
done
# JDK classes and their lambda forms (ids only matter for custom loaders),
# plus the JDK's default class list.
jdk() {
  grep -hE '^((java|javax|jdk|sun|com/sun)/|@lambda-form-invoker |@lambda-proxy (java|javax|jdk|sun|com/sun)/)' "$home/lib/classlist" "$@" |
    sed 's/ id: [0-9]*$//' | awk '!seen[$0]++'
}
mkdir "$work/empty" "$work/out"
cd "$work/empty"
for archive in javac run; do
  jdk "$work"/$archive-*.classlist > "$work/$archive.classlist"
  # G1 at dump time also archives heap objects; runs may use any GC.
  /usr/bin/java -Xshare:dump -XX:+UseG1GC -XX:SharedClassListFile="$work/$archive.classlist" \
    -XX:SharedArchiveFile="$work/out/$archive.jsa" > /dev/null
done
# -Xshare:on fails unless the archive maps, with the judge's own flags.
cd "$work/acm"
/usr/bin/javac -J-Xshare:on -J-XX:SharedArchiveFile="$work/out/javac.jsa" -J-XX:TieredStopAtLevel=1 -J-XX:+UseSerialGC -encoding UTF-8 Main.java
/usr/bin/java -Xshare:on -XX:SharedArchiveFile="$work/out/run.jsa" -Xmx153m -Xss64m -XX:ReservedCodeCacheSize=32m \
  -XX:MaxMetaspaceSize=64m -XX:ActiveProcessorCount=1 -cp . Main < "$src/acm/input.txt" > /dev/null
mkdir -p "$out"
install -m 0444 "$work/out/javac.jsa" "$out/javac.jsa"
install -m 0644 "$work/out/run.jsa" "$home/lib/server/classes.jsa"
/usr/bin/java -Xshare:on -version > /dev/null 2>&1
rm -r "$work"
