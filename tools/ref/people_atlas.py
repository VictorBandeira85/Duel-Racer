#!/usr/bin/env python3
"""Junta as poses de cada personagem numa folha só (atlas), sem perda: mesmos pixels.

  src/assets/people/cop-<ID>-<pose>.png  -> src/assets/people/atlas/cop-<ID>.png
  src/assets/people/att-<ID>-<pose>.png  -> src/assets/people/atlas/att-<ID>.png
  + src/assets/people/atlas/atlas.json: {"cop-A1": {"stand": [x, y, w, h], ...}, ...}

Um atlas por policial e um por frentista: a tela baixa só o personagem que usa. Os PNGs soltos ficam
no repositório (as ferramentas de arte escrevem neles); o jogo (src/people.ts) importa só os atlas.
Rodar de novo sempre que um cop_*.py / att_*.py regravar as poses.
Uso: python3 tools/ref/people_atlas.py
"""
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src/assets/people'
OUT = SRC / 'atlas'
GAP = 1  # coluna vazia entre as poses

groups = {}
for f in sorted(SRC.glob('*.png')):
    m = re.fullmatch(r'(cop-[A-Z]\d|att-[A-Za-z]+)-(\w+)\.png', f.name)
    if m:
        groups.setdefault(m[1], []).append((m[2], f))

OUT.mkdir(exist_ok=True)
meta = {}
for name, poses in sorted(groups.items()):
    ims = [(p, Image.open(f).convert('RGBA')) for p, f in poses]
    W = sum(im.width for _, im in ims) + GAP * (len(ims) - 1)
    H = max(im.height for _, im in ims)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = 0
    rects = {}
    for p, im in ims:
        sheet.paste(im, (x, 0))
        rects[p] = [x, 0, im.width, im.height]
        x += im.width + GAP
    # conferência: cada recorte igual ao PNG de origem
    for p, im in ims:
        r = rects[p]
        assert sheet.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])).tobytes() == im.tobytes(), (name, p)
    sheet.save(OUT / f'{name}.png', optimize=True)
    meta[name] = rects
    print(f'{name}: {len(ims)} poses, {W}x{H}')

(OUT / 'atlas.json').write_text(json.dumps(meta, separators=(',', ':')) + '\n')
print(f'{len(meta)} atlas -> {OUT}')
