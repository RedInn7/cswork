#!/bin/sh
set -eu
umask 077
mkdir -p /tmp/home /tmp/cache
case "$1" in
  python)
    : > /workspace/main.py
    exec pyright-langserver --stdio
    ;;
  go)
    printf 'module cswork.local/document\n\ngo 1.24.4\n' > /workspace/go.mod
    : > /workspace/main.go
    exec gopls serve
    ;;
  cpp)
    printf '%s\n' '-std=c++20' '-Wall' '-Wextra' > /workspace/compile_flags.txt
    : > /workspace/main.cpp
    exec clangd-19 --background-index=false --clang-tidy=false --header-insertion=never --pch-storage=memory -j=1 --log=error
    ;;
  java)
    : > /workspace/Main.java
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?><projectDescription><name>cswork</name><comment></comment><projects></projects><buildSpec><buildCommand><name>org.eclipse.jdt.core.javabuilder</name><arguments></arguments></buildCommand></buildSpec><natures><nature>org.eclipse.jdt.core.javanature</nature></natures></projectDescription>' > /workspace/.project
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?><classpath><classpathentry kind="src" path="" excluding="bin/"/><classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER"/><classpathentry kind="output" path="bin"/></classpath>' > /workspace/.classpath
    mkdir /workspace/.settings
    printf '%s\n' 'eclipse.preferences.version=1' 'org.eclipse.jdt.core.compiler.processAnnotations=disabled' > /workspace/.settings/org.eclipse.jdt.core.prefs
    jdt_config=/opt/jdtls/config_linux
    if [ "$(uname -m)" = aarch64 ] && [ -d /opt/jdtls/config_linux_arm ]; then jdt_config=/opt/jdtls/config_linux_arm; fi
    cp -r "$jdt_config" /tmp/jdt-config
    exec java -Xms64m -Xmx768m -XX:ActiveProcessorCount=2 \
      -Declipse.application=org.eclipse.jdt.ls.core.id1 \
      -Dosgi.bundles.defaultStartLevel=4 -Declipse.product=org.eclipse.jdt.ls.core.product \
      -Dlog.level=ERROR -Djava.import.generatesMetadataFilesAtProjectRoot=false \
      --add-modules=ALL-SYSTEM --add-opens java.base/java.util=ALL-UNNAMED \
      --add-opens java.base/java.lang=ALL-UNNAMED \
      -jar /opt/jdtls/plugins/org.eclipse.equinox.launcher_*.jar \
      -configuration /tmp/jdt-config -data /tmp/jdt-workspace
    ;;
  *) echo 'Unsupported language' >&2; exit 64 ;;
esac
