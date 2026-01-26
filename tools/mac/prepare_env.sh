#!/bin/bash

set -e

cd "$(dirname "$0")"
cd ..
cd ..

python -m venv pyenv

source pyenv/bin/activate

python -m pip install -r tools/requirements.txt
python -m pip install -r service/requirements.txt
python -m pip install -r winapp/requirements.txt
python tools/prepare_env/prepare_env.py -d deps

cd web
npm install -y