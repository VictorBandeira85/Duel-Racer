#!/bin/sh
# Gera os sprites dos carros desenhados por código direto nas pastas do jogo.
set -e
cd "$(dirname "$0")"
python3 sides.py ../../src/assets/cars
python3 rears.py ../../src/assets/cars
python3 interiors.py ../../src/assets/cockpit
