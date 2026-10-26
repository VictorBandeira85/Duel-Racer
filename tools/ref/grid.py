"""Redimensiona uma foto de referência e sobrepõe uma grade numerada para medir posições.

Uso: python3 tools/ref/grid.py <foto> <saida.png> <largura> [x0 y0 x1 y1 (recorte em fração 0-1)]
"""
import sys

from PIL import Image, ImageDraw


def main():
    src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
    im = Image.open(src).convert('RGB')
    if len(sys.argv) >= 8:
        x0, y0, x1, y1 = map(float, sys.argv[4:8])
        W, H = im.size
        im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
    h = round(im.height * width / im.width)
    small = im.resize((width, h), Image.LANCZOS)
    scale = max(1, 1200 // width)
    big = small.resize((width * scale, h * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for x in range(0, width, 8):
        major = x % 32 == 0
        d.line([(x * scale, 0), (x * scale, h * scale)], fill=(255, 0, 255) if major else (120, 120, 120), width=1)
        if major:
            d.text((x * scale + 2, 2), str(x), fill=(255, 255, 0))
    for y in range(0, h, 8):
        major = y % 32 == 0
        d.line([(0, y * scale), (width * scale, y * scale)], fill=(255, 0, 255) if major else (120, 120, 120), width=1)
        if major:
            d.text((2, y * scale + 2), str(y), fill=(255, 255, 0))
    big.save(out)
    small.save(out.replace('.png', '-small.png'))
    print(out, small.size)


if __name__ == '__main__':
    main()
