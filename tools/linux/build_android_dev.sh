#!/bin/bash

set -e
set -x

cd "$(dirname "$0")"
cd ..
cd ..
cd app

# 本地 EAS 构建时 Gradle daemon 可能继承默认 Metaspace，模块较多时会 OOM
export GRADLE_OPTS="${GRADLE_OPTS:-} -Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Xmx4096m -XX:MaxMetaspaceSize=1024m"

eas build -p android --profile development --output tvsurf-android-dev.apk --local
