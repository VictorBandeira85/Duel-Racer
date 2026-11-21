"""Tira o chuvisco das cabines já reduzidas (quando a arte original não existe mais para refazer com
cockpit_reduce.py): um pixel que destoa dos 8 vizinhos numa área lisa (vizinhos parecidos entre si) vira a
mediana deles; depois paleta curta (k-médias em Lab). Detalhes de verdade (letras, frisos, botões) têm vizinhos
diferentes entre si e ficam. Uso: python3 tools/ref/cockpit_despeckle.py <png> ...
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from cockpit_reduce import palette  # noqa: E402


def despeckle(rgba, passes=2):
    a = rgba.copy()
    al = a[..., 3] > 0
    for _ in range(passes):
        rgb = a[..., :3].astype(np.int16)
        H, W = al.shape
        pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
        pal = np.pad(al, 1)
        nb = [pad[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
        nba = [pal[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
        st = np.stack(nb)                                  # 8 x H x W x 3
        med = np.median(st, axis=0)
        spread = np.abs(st - med).sum(axis=3).max(axis=0)  # quão parecidos os vizinhos são entre si
        diff = np.abs(rgb - med).sum(axis=2)
        allop = np.stack(nba).all(axis=0)
        fix = al & allop & (diff > 45) & (spread < 40)
        a[..., :3][fix] = med[fix].astype(np.uint8)
    return a


for p in sys.argv[1:]:
    im = np.array(Image.open(p).convert('RGBA'))
    out = palette(despeckle(im), 96)
    Image.fromarray(out, 'RGBA').save(p, optimize=True)
    print(os.path.basename(p))
