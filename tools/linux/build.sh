#!/bin/bash

set -e

cd "$(dirname "$0")"
cd ..
cd ..

bash tools/linux/prepare_env.sh

cd web
npm run build
cd ..

source pyenv/bin/activate
pyinstaller tools/linux/pyinstaller.spec -y

# fix chrome lib dependencies
cd dist/tvsurf/_internal
ln -s libdrm-*.so.2.* libdrm.so.2
ln -s libxcb-*.so.1.* libxcb.so.1
cd ../../..