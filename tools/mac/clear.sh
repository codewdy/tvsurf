#!/bin/bash

set -e

cd "$(dirname "$0")"
cd ..
cd ..

rm -rf dist
rm -rf build
rm -rf pyenv
rm -rf deps
rm -rf web/node_modules
rm -rf web/build