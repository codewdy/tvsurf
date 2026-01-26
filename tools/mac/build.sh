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

rm -rf dist/tvsurf
mkdir -p dist/tvsurf
cp -r dist/tvsurf.app dist/tvsurf/tvsurf.app
cp config.yaml dist/tvsurf/config.yaml
