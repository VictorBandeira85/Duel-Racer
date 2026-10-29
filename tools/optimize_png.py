"""Compressão SEM PERDA das imagens do jogo (oxipng): o arquivo fica menor e cada pixel continua
com exatamente a mesma cor. Cada imagem otimizada é conferida pixel a pixel contra a original
antes de substituir; se qualquer pixel diferir (ou não ficar menor), a original fica.

Uso: pip install pyoxipng && python3 tools/optimize_png.py src/assets
"""
import os
import sys

import numpy as np
import oxipng
from PIL import Image


def pixels(data_or_path):
    im = Image.open(data_or_path)
    return np.array(im.convert('RGBA'))


def main():
    root = sys.argv[1]
    before = after = 0
    kept = 0
    import io
    for dp, _, files in os.walk(root):
        for f in sorted(files):
            if not f.endswith('.png'):
                continue
            p = os.path.join(dp, f)
            raw = open(p, 'rb').read()
            before += len(raw)
            opt = oxipng.optimize_from_memory(raw, level=6, strip=oxipng.StripChunks.safe())
            if len(opt) < len(raw) and np.array_equal(pixels(io.BytesIO(raw)), pixels(io.BytesIO(opt))):
                open(p, 'wb').write(opt)
                after += len(opt)
            else:
                after += len(raw)
                kept += 1
    print(f'antes {before / 1024:.0f} KB, depois {after / 1024:.0f} KB ({100 * (1 - after / before):.0f}% menor); {kept} já estavam no mínimo')


if __name__ == '__main__':
    main()
