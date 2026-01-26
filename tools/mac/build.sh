#!/bin/bash

set -e
set -x

cd "$(dirname "$0")"
cd ..
cd ..

bash tools/mac/prepare_env.sh

cd web
npm run build
cd ..

source pyenv/bin/activate
pyinstaller tools/mac/pyinstaller.spec -y

cp config.yaml dist/tvsurf/config.yaml