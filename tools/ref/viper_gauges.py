"""Mostradores grandes do Serpe V10 a partir da arte do Victor (cab-nowheel.png), na resolução
da arte (o jogo desenha esta imagem por cima do painel, com mais detalhe que um pixel do jogo):
- fica tudo da arte: fundo creme, marcações, faixa amarela e vermelha, "MPH" e "RPM x1000"
- saem o ponteiro e o miolo pintados (o jogo desenha os dele, girando)
- os números da arte tinham repetições (60 duas vezes, 180 três vezes, "6 6 8 8"): cada número
  é apagado e reescrito no mesmo lugar, em fonte grotesca negrita, preta, do mesmo tamanho:
  velocímetro 20..200 mph (de 20 em 20, 29° entre eles) e conta-giros 0..8
Uso: python3 tools/ref/viper_gauges.py <cab-nowheel.png> <src/assets/cockpit>
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
# centro (miolo), raio do fundo, raio dos números, ângulo do primeiro número, passo, valores,
# meia caixa apagada em volta de cada número, corpo da fonte
DIALS = {
    'speed': dict(c=(462, 395), r=86, rl=55, ro=62, a0=149, step=29, vals=list(range(20, 201, 20)), box=(28, 14), size=21),
    'tach': dict(c=(747, 395), r=84, rl=56, ro=63, a0=132, step=28.25, vals=list(range(0, 9)), box=(16, 14), size=22),
}


def main():
    src, out = sys.argv[1], sys.argv[2]
    art = np.array(Image.open(src).convert('RGB'))
    H, W = art.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    font = ImageFont.truetype(FONT, 22)
    for name, d in DIALS.items():
        cx, cy = d['c']
        r = d['r']
        a = art.copy()
        dd = np.hypot(xx - cx, yy - cy)
        rgb = a.astype(int)
        face = np.median(a[(dd < r) & (dd > r * 0.55) & (rgb.min(axis=2) > 175)], axis=0)
        # ponteiro vermelho e miolo preto (com o rabicho) viram fundo
        redn = (rgb[..., 0] > 140) & (rgb[..., 0] > rgb[..., 1] * 1.6) & (dd < r)
        redn &= ~((dd > r * 0.82) & (rgb[..., 1] > 60))  # a faixa amarela/vermelha da borda fica
        hub = (dd < r * 0.24) & (rgb.max(axis=2) < 150)
        import cv2
        k = np.ones((7, 7), np.uint8)
        near = cv2.dilate((redn | hub).astype(np.uint8), k) > 0
        # contorno escuro do ponteiro e do miolo (tudo o que não é creme em volta deles)
        clear = (redn | hub | (near & (np.abs(rgb - face).sum(axis=2) > 18))) & (dd < r * 0.84)
        # ponta do ponteiro até a borda (fora da faixa colorida, que fica entre 12 e 3 horas)
        ang = np.degrees(np.arctan2(yy - cy, xx - cx)) % 360
        tip = (rgb[..., 0] > 140) & (rgb[..., 1] < 80) & (dd < r * 0.97) & ~((ang > 255) & (ang < 365))
        clear |= cv2.dilate(tip.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (dd < r * 0.97)
        # números antigos: o escuro dentro da caixa de cada posição
        for i, v in enumerate(d['vals']):
            ang = math.radians(d['a0'] + i * d['step'])
            lx, ly = cx + math.cos(ang) * d['ro'], cy + math.sin(ang) * d['ro']  # onde estava o número antigo
            bw, bh = d['box']
            boxm = (np.abs(xx - lx) <= bw) & (np.abs(yy - ly) <= bh) & (dd < r * 0.77)
            clear |= boxm & (rgb.min(axis=2) < 205)
        # o antigo terceiro "180" fica mais embaixo, entre o 180 e o "MPH"
        # (apaga só o que for escuro e fique fora das marcações)
        a[clear & (dd < r)] = face.astype(np.uint8)
        # sombra suave na borda de baixo do fundo (como a arte)
        im = Image.fromarray(a)
        dr = ImageDraw.Draw(im)
        f = ImageFont.truetype(FONT, d['size'])
        for i, v in enumerate(d['vals']):
            ang = math.radians(d['a0'] + i * d['step'])
            lx, ly = cx + math.cos(ang) * d['rl'], cy + math.sin(ang) * d['rl']
            t = str(v)
            x0, y0, x1, y1 = dr.textbbox((0, 0), t, font=f)
            tw, th = x1 - x0, y1 - y0
            # condensa os de três dígitos (como na arte) desenhando numa camada à parte
            lay = Image.new('L', (tw + 4, th + 4), 0)
            ImageDraw.Draw(lay).text((2 - x0, 2 - y0), t, font=f, fill=255)
            if len(t) == 3:
                lay = lay.resize((int(lay.width * 0.82), lay.height), Image.LANCZOS)
            px, py = int(round(lx - lay.width / 2)), int(round(ly - lay.height / 2))
            im.paste((22, 22, 26), (px, py), lay)
        a = np.array(im)
        # recorte: só o fundo redondo (o aro fica no painel)
        R = r + 4
        x0, y0 = cx - R, cy - R
        crop = a[y0:y0 + 2 * R + 1, x0:x0 + 2 * R + 1]
        gy, gx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
        al = (np.hypot(gx - R, gy - R) <= r + 3).astype(np.uint8) * 255
        Image.fromarray(np.dstack([crop, al]), 'RGBA').save(os.path.join(out, f'viper-{name}face.png'), optimize=True)
        print(name, 'canto', (x0, y0), 'lado', 2 * R + 1)


def aux(art, out):
    # os quatro pequenos: a arte em alta resolução, sem os ponteiros pintados
    import cv2
    rgb = art.astype(int)
    H, W = art.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    red = (rgb[..., 0] > 120) & (rgb[..., 0] > rgb[..., 1] * 1.6) & (rgb[..., 0] > rgb[..., 2] * 1.6)
    centers = [(1036, 293), (1144, 293), (1253, 293), (1362, 293)]
    m = np.zeros((H, W), np.uint8)
    for cx, cy in centers:
        dd = np.hypot(xx - cx, yy - cy)
        m |= (red & (dd < 40)).astype(np.uint8)
        hub = (dd < 40) & (np.hypot(xx - cx, yy - (cy + 17)) < 12) & (rgb.max(axis=2) < 90)
        m |= hub.astype(np.uint8)
    clean = art.copy()
    for cx, cy in centers:
        dd = np.hypot(xx - cx, yy - cy)
        face = np.median(art[(dd < 36) & (rgb.min(axis=2) > 185)], axis=0)
        r0 = cv2.dilate((red & (dd < 40)).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
        near = r0 & (np.abs(rgb - face).sum(axis=2) > 25) & (dd < 37)
        hubm = (np.hypot(xx - cx, yy - (cy + 17)) < 11) & (rgb.max(axis=2) < 140)
        fix = (near | hubm | (red & (dd < 37)))
        fix = cv2.dilate(fix.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (dd < 38)
        # fundo local (convolução normalizada só com o creme que sobrou): o sombreado continua
        w = ((~fix) & (rgb.min(axis=2) > 170) & (dd < 39)).astype(np.float32)
        num = cv2.GaussianBlur(art.astype(np.float32) * w[..., None], (0, 0), 5)
        den = cv2.GaussianBlur(w, (0, 0), 5)[..., None]
        val = np.clip(num / np.maximum(den, 1e-3), 0, 255).astype(np.uint8)
        clean[fix] = val[fix]
    for i, (cx, cy) in enumerate(centers):
        R = 40
        crop = clean[cy - R:cy + R + 1, cx - R:cx + R + 1]
        gy, gx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
        al = (np.hypot(gx - R, gy - R) <= 39).astype(np.uint8) * 255
        Image.fromarray(np.dstack([crop, al]), 'RGBA').save(os.path.join(out, f'viper-aux{i}.png'), optimize=True)
        print('aux', i, 'canto', (cx - R, cy - R), 'lado', 2 * R + 1)


if __name__ == '__main__':
    main()
    aux(np.array(Image.open(sys.argv[1]).convert('RGB')), sys.argv[2])
