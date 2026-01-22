#!/bin/bash

set -e
set -x

cd "$(dirname "$0")"
cd ..
cd ..
cd app

eas build -p android --profile production --output tvsurf-android.apk --local