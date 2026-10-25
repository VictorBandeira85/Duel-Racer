"""Mede uma captura de referência do jogo original.

Recorta a área do jogo (remove bordas pretas), reconstrói os pixels nativos do
Super Nintendo (256x224), extrai a paleta e gera uma ampliação com grade para
ler posições exatas.

Uso: python3 tools/ref/measure.py <captura.png> <pasta-de-saida>

As capturas do jogo original servem só como referência de medida: nunca entram
no jogo nem no repositório (direitos autorais).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

NATIVE_W, NATIVE_H = 256, 224


def game_area(img: np.ndarray):
    """Área do jogo: a imagem 4:3 ocupa toda a altura do vídeo; a borda esquerda é
    a primeira coluna que deixa de ser preta (as laterais do player podem ter fundo
    desfocado, por isso a largura vem da altura e não da borda direita)."""
    h = img.shape[0]
    lum = img.mean(axis=2)
    cols = np.where(lum.mean(axis=0) > 18)[0]
    left = int(cols[0])
    return left, left + round(h * 4 / 3), 0, h


def to_native(img: np.ndarray, box) -> np.ndarray:
    """Amostra o centro de cada pixel nativo (mediana 3x3 contra o borrão do vídeo)."""
    x0, x1, y0, y1 = box
    sx, sy = (x1 - x0) / NATIVE_W, (y1 - y0) / NATIVE_H
    out = np.zeros((NATIVE_H, NATIVE_W, 3), np.uint8)
    for j in range(NATIVE_H):
        cy = int(y0 + (j + 0.5) * sy)
        for i in range(NATIVE_W):
            cx = int(x0 + (i + 0.5) * sx)
            win = img[max(0, cy - 1):cy + 2, max(0, cx - 1):cx + 2].reshape(-1, 3)
            out[j, i] = np.median(win, axis=0)
    return out


def zoom_with_grid(native: np.ndarray, scale=4) -> Image.Image:
    im = Image.fromarray(native).resize((NATIVE_W * scale, NATIVE_H * scale), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for x in range(0, NATIVE_W, 8):
        d.line([(x * scale, 0), (x * scale, NATIVE_H * scale)], fill=(255, 0, 255) if x % 32 == 0 else (90, 90, 90), width=1)
        if x % 32 == 0:
            d.text((x * scale + 2, 2), str(x), fill=(255, 255, 0))
    for y in range(0, NATIVE_H, 8):
        d.line([(0, y * scale), (NATIVE_W * scale, y * scale)], fill=(255, 0, 255) if y % 32 == 0 else (90, 90, 90), width=1)
        if y % 32 == 0:
            d.text((2, y * scale + 2), str(y), fill=(255, 255, 0))
    return im


def palette(native: np.ndarray, n=24):
    q = Image.fromarray(native).quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: n * 3]
    counts = np.bincount(np.array(q).ravel(), minlength=n)
    order = np.argsort(-counts)
    return [('#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]), int(counts[i])) for i in order if counts[i] > 0]


def row_bands(native: np.ndarray, threshold=40):
    """Linhas onde a cor média muda bruscamente (bordas de teto, horizonte, painel...)."""
    means = native.astype(int).mean(axis=1)
    changes = []
    for y in range(1, NATIVE_H):
        dist = np.abs(means[y] - means[y - 1]).sum()
        if dist > threshold:
            changes.append((y, '#%02x%02x%02x' % tuple(means[y].astype(int))))
    return changes


def main():
    src, outdir = Path(sys.argv[1]), Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)
    img = np.array(Image.open(src).convert('RGB'))
    box = game_area(img)
    native = to_native(img, box)
    Image.fromarray(native).save(outdir / 'native.png')
    zoom_with_grid(native).save(outdir / 'zoom.png')
    print('área do jogo na captura:', box)
    print('paleta (cor, pixels):')
    for c, n in palette(native):
        print(f'  {c}  {n}')
    print('mudanças bruscas por linha (y, cor média):')
    for y, c in row_bands(native):
        print(f'  y={y:3d} {c}')


if __name__ == '__main__':
    main()
