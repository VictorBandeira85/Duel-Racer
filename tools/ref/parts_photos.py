"""Peças de preparação (pixel art do Victor): capas da revista (src/assets/photos/pc-*.png, 560 x 315) e
miniaturas para a tela de preparação (src/assets/parts/*.png, 96 x 96). As peças com fundo transparente
ganham um fundo de estúdio próprio (cor de cada peça, faixas diagonais e sombra no chão); as que já vêm
com fundo (bancos, suspensão, escapamento) são enquadradas. Marcas reais somem: no motor, o letreiro e
o escudo das tampas viram "Toro" e o logo da Toro (src/assets/brands.json).
Uso: python3 tools/ref/parts_photos.py <pasta com as peças .png> <src/assets>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

# peça: cor do fundo (None = usa o fundo da própria arte)
PARTS = {
    'motor': (120, 84, 16), 'pistao': (70, 52, 130), 'comando': (140, 26, 30), 'carburador': (24, 104, 66),
    'injecao': (16, 92, 108), 'turbo': (28, 70, 132), 'escape': None, 'suspensao': None, 'freio': (130, 62, 14),
    'bancos': None,
}
W, H, T = 560, 315, 96


def debrand_motor(im):
    a = np.array(im)
    rgb = a[..., :3].astype(int)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    pm = np.zeros(a.shape[:2], np.uint8)
    cv2.fillPoly(pm, [np.array([(868, 400), (1100, 296), (1218, 286), (1228, 362), (1092, 412), (900, 478), (866, 472)], np.int32)], 1)
    yellow = (rgb[..., 0] > 150) & (rgb[..., 1] > 90) & (rgb[..., 2] < 110)
    dark = rgb.sum(axis=2) < 70
    cover = np.array([44, 40, 56])
    txt = (pm > 0) & (yellow | dark)
    a[..., :3][cv2.dilate(txt.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = cover
    sh = ((xx - 803) / 66.0) ** 2 + ((yy - 472) / 70.0) ** 2 <= 1
    a[..., :3][sh] = cover
    im = Image.fromarray(a)
    lay = Image.new('RGBA', (360, 130), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((180, 65), 'Toro', font=ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf', 104), fill=(240, 176, 30, 255), anchor='mm', stroke_width=3, stroke_fill=(16, 14, 18, 255))
    lay = lay.rotate(23, resample=Image.BICUBIC, expand=True)
    im.alpha_composite(lay, (1040 - lay.width // 2, 388 - lay.height // 2))
    lg = Image.fromarray(logo_img('toro', 90), 'RGBA')
    im.alpha_composite(lg, (803 - 45, 472 - 45))
    return im


def backdrop(w, h, col):
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot((xx - w * 0.5) / (w * 0.62), (yy - h * 0.46) / (h * 0.7))
    k = np.clip(1 - d, 0, 1)[..., None] ** 1.3
    c = np.array(col, float)
    a = c * (0.18 + 1.05 * k) + np.array([10, 8, 12]) * (1 - k)
    stripe = (((xx + yy * 0.9) // (w / 14)) % 2 == 0)[..., None]  # faixas diagonais largas, discretas
    a = a * np.where(stripe, 1.0, 0.86)
    floor = (yy > h * 0.8)[..., None]
    a = np.where(floor, a * 0.62, a)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')


def compose(im, col, w, h, pad, low=0.0):
    """peça (com alfa) centrada num fundo de estúdio; devolve a imagem e a caixa da peça"""
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    p = im.crop(bb)
    k = min((w - 2 * pad) / p.width, (h - 2 * pad - h * low) / p.height)
    p = p.resize((max(1, int(p.width * k)), max(1, int(p.height * k))), Image.LANCZOS)
    bg = backdrop(w, h, col)
    x, y = (w - p.width) // 2, int((h - h * low - p.height) / 2)
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([x + p.width * 0.08, y + p.height - h * 0.03, x + p.width * 0.92, y + p.height + h * 0.05], fill=(0, 0, 0, 120))
    bg.alpha_composite(sh)
    bg.alpha_composite(p, (x, y))
    return bg.convert('RGB'), (x, y, x + p.width, y + p.height)


def cover(im, w, h, contain=False):
    """arte com fundo próprio: cobre o quadro (miniatura) ou cabe inteira nele, com as sobras na cor do
    fundo da arte, escurecendo para as bordas (capa)"""
    im = im.convert('RGBA')
    bg = Image.new('RGBA', im.size, (20, 6, 44, 255))
    bg.alpha_composite(im)
    if contain:
        k = min(w / im.width, h / im.height)
        r = bg.resize((int(round(im.width * k)), int(round(im.height * k))), Image.LANCZOS)
        col = np.median(np.array(r.convert('RGB'))[:6, :6].reshape(-1, 3), axis=0)
        out = backdrop(w, h, tuple(col * 1.6))
        out.alpha_composite(r, ((w - r.width) // 2, (h - r.height) // 2))
        return out.convert('RGB')
    k = max(w / im.width, h / im.height)
    r = bg.resize((int(round(im.width * k)), int(round(im.height * k))), Image.LANCZOS)
    x, y = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((x, y, x + w, y + h)).convert('RGB')


def main():
    src, assets = sys.argv[1], sys.argv[2]
    for name, col in PARTS.items():
        im = Image.open(os.path.join(src, f'{name}.png')).convert('RGBA')
        if name == 'motor':
            im = debrand_motor(im)
        if col:
            ph, box = compose(im, col, W, H, 14, 0.07)
            ti, _ = compose(im, col, T, T, 5)
        else:
            ph, box = cover(im, W, H, True), (10, 10, W - 10, H - 20)
            ti = cover(im.crop((0, 0, im.width // 2, im.height)) if name == 'bancos' else im, T, T)
        ph.quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(assets, 'photos', f'pc-{name}.png'), optimize=True)
        ti.quantize(48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(assets, 'parts', f'{name}.png'), optimize=True)
        print(name, 'box', [int(v) for v in box])


if __name__ == '__main__':
    main()
