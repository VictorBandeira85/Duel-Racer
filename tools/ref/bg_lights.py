"""Fundos com luzes acesas na arte (cidade, zona industrial): separa dia e noite.
- <nome>.png (dia): janelas e luzes apagadas (viram o vidro escuro azulado das janelas)
- <nome>-night.png (noite): o resto já escurecido como os fundos gerados (x0,42) e as luzes acesas,
  com o brilho cheio (bgart.ts usa este arquivo à noite sem escurecer de novo)
Uso: python3 tools/ref/bg_lights.py src/assets/bg/<nome>.png
"""
import sys

import numpy as np
from PIL import Image


def main():
    p = sys.argv[1]
    a = np.array(Image.open(p).convert('RGBA')).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    lit = (al > 0) & (((r > 170) & (g > 110) & (b < 120) & (r - b > 80)) | ((r > 190) & (g < 110) & (b < 110)))
    day = a.copy()
    day[lit, 0], day[lit, 1], day[lit, 2] = 58, 68, 104
    night = a.copy()
    night[..., :3] = (night[..., :3] * 0.42).astype(int)
    night[lit, :3] = a[lit, :3]
    Image.fromarray(day.astype(np.uint8)).save(p, optimize=True)
    Image.fromarray(night.astype(np.uint8)).save(p.replace('.png', '-night.png'), optimize=True)
    print(p, 'luzes:', int(lit.sum()))


if __name__ == '__main__':
    main()
