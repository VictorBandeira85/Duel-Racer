"""Quadro de instrumentos do Kaze NX (Honda NSX) desenhado em alta resolução, copiando a foto do
quadro real que o Victor enviou:
- fundo de alumínio escovado (riscos horizontais finos), contorno curvo que abraça os mostradores,
  janelinhas escuras das luzes-espia no alto
- mostradores pretos com aro fino prateado, marcações brancas finas (todas as divisões),
  números brancos numa grotesca negrita levemente condensada
- conta-giros 0-9 (x1000r/min) com o bloco vermelho de 8 a 9 por dentro das marcações;
  velocímetro 0-280 km/h numerado de 20 em 20
- os quatro pequenos com o arco virado para o centro: água (com o vermelho no alto), óleo 0-4-8,
  combustível 0-1/2-1 e bateria 8-12-16, com os ícones
O jogo desenha por cima só os ponteiros (vermelhos, afinados) e os hodômetros.
Uso: python3 tools/ref/nx_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

K = 12                      # desenha em dobro (6 px por pixel do jogo no fim) e reduz: traços suavizados
PY = 8 / 7                  # o pixel do jogo é mais largo: na vertical tudo é 8/7 maior
X0, Y0, X1, Y1 = 38, 14, 220, 94  # região do quadro (coordenadas do jogo)
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
# mostradores: x, y, r (jogo)
TACH = dict(x=100, y=50, r=22.5, a0=125, sweep=265, max=9)
SPEED = dict(x=157, y=50, r=22.5, a0=112, sweep=268, max=280)
AUX = [
    dict(x=71, y=40, r=7.5, arc=(130, -76), kind='water'),
    dict(x=62, y=64, r=8.5, arc=(76, -76), kind='oil', labels=['0', '4', '8']),
    dict(x=186, y=40, r=7.5, arc=(104, 256), kind='fuel', labels=['0', '½', '1']),
    dict(x=195, y=64, r=8.5, arc=(104, 256), kind='volt', labels=['8', '12', '16']),
]
W, H = (X1 - X0) * K, int(round((Y1 - Y0) * K))


def P(x, y):  # coordenadas do jogo -> imagem
    return ((x - X0) * K, (y - Y0) * K)


def ell(d, cx, cy, r, **kw):
    x, y = P(cx, cy)
    d.ellipse([x - r * K, y - r * K * PY, x + r * K, y + r * K * PY], **kw)


def at(cx, cy, ang, rr):
    x, y = P(cx, cy)
    a = math.radians(ang)
    return (x + math.cos(a) * rr * K, y + math.sin(a) * rr * K * PY)


def tick(d, g, ang, r0, r1, w, col='white'):
    d.line([at(g['x'], g['y'], ang, r0), at(g['x'], g['y'], ang, r1)], fill=col, width=w)


def text(im, s, cx, cy, size, col=(244, 244, 244), squeeze=0.9):
    f = ImageFont.truetype(FONT, size)
    d0 = ImageDraw.Draw(Image.new('L', (4, 4)))
    x0, y0, x1, y1 = d0.textbbox((0, 0), s, font=f)
    lay = Image.new('L', (x1 - x0 + 4, y1 - y0 + 4), 0)
    ImageDraw.Draw(lay).text((2 - x0, 2 - y0), s, font=f, fill=255)
    lay = lay.resize((max(1, int(lay.width * squeeze)), lay.height), Image.LANCZOS)
    im.paste(col, (int(cx - lay.width / 2), int(cy - lay.height / 2)), lay)


def main():
    out = sys.argv[1]
    rng = np.random.default_rng(5)
    # alumínio escovado
    base = np.zeros((H, W, 3), np.float32)
    rows = rng.normal(0, 7, size=(H, 1))
    base[:] = (132 + rows)[:, :, None]
    base += rng.normal(0, 3, size=(H, W, 1))
    yy = np.arange(H)[:, None, None] / H
    base += -50 * np.clip(1 - yy / 0.28, 0, 1) - 18 * np.clip((yy - 0.8) / 0.2, 0, 1)  # sombra da cobertura e embaixo
    base[..., 2] += 6
    im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    # contorno curvo (envoltória dos mostradores)
    pts = []
    for g in [TACH, SPEED] + AUX:
        for t in range(0, 360, 6):
            pts.append(at(g['x'], g['y'], t, g['r'] + 3.6))
    from PIL import ImageChops
    hull = Image.new('L', (W, H), 0)
    import cv2
    hp = cv2.convexHull(np.array(pts, np.float32)).astype(np.int32).reshape(-1, 2)
    ImageDraw.Draw(hull).polygon([tuple(p) for p in hp], fill=255)
    d = ImageDraw.Draw(im)
    # janelinhas das luzes-espia no alto (apagadas)
    for (x, y, w_, h_) in [(121, 22, 15, 3), (124, 27, 9, 2.5), (82, 24, 7, 2.2), (60, 31, 7, 2.2), (170, 24, 7, 2.2), (188, 31, 9, 2.2)]:
        a, b = P(x, y)
        d.rounded_rectangle([a, b, a + w_ * K, b + h_ * K * PY], radius=K, fill=(28, 28, 32))
    # mostradores grandes
    for g, labels, minor, red in [(TACH, list(range(10)), 0.25, 8), (SPEED, list(range(0, 281, 20)), 5, None)]:
        ell(d, g['x'], g['y'], g['r'] + 0.9, fill=(170, 172, 178))
        ell(d, g['x'], g['y'], g['r'] + 0.3, fill=(40, 40, 44))
        ell(d, g['x'], g['y'], g['r'], fill=(14, 14, 16))
        fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
        if red is not None:  # bloco vermelho de 8 a 9 por dentro das marcações
            for k in range(60):
                v = red + (g['max'] - red) * k / 59
                tick(d, g, fr(v), g['r'] - 4.6, g['r'] - 2.2, int(K * 0.9), (226, 34, 24))
        v = 0.0
        while v <= g['max'] + 1e-6:
            if any(abs(v - L) < 1e-6 for L in labels):
                tick(d, g, fr(v), g['r'] - 3.2, g['r'] - 0.8, int(K * 0.55))
            elif g is SPEED and abs(v / 10 - round(v / 10)) < 1e-6:
                tick(d, g, fr(v), g['r'] - 2.2, g['r'] - 0.8, int(K * 0.4))
            else:
                tick(d, g, fr(v), g['r'] - 1.6, g['r'] - 0.8, int(K * 0.3))
            v += minor
        for L in labels:
            x, y = at(g['x'], g['y'], fr(L), g['r'] - (6.6 if g is TACH else 6.8))
            text(im, str(L), x, y, int(K * (5.6 if g is TACH else 3.2)), squeeze=0.95 if g is TACH else 0.86)
        x, y = P(g['x'], g['y'] + g['r'] * 0.62 * PY)
        text(im, 'x1000r/min' if g is TACH else 'km/h', x + (K * 3 if g is TACH else 0), y, int(K * 1.6), squeeze=1)
    # pequenos
    for g in AUX:
        ell(d, g['x'], g['y'], g['r'] + 0.7, fill=(165, 167, 173))
        ell(d, g['x'], g['y'], g['r'], fill=(14, 14, 16))
        a0, a1 = g['arc']
        n = 8
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            big = i % 4 == 0
            col = (226, 40, 26) if g['kind'] == 'water' and i >= 7 else 'white'
            tick(d, g, a, g['r'] - (2.1 if big else 1.5), g['r'] - 0.6, int(K * (0.45 if big else 0.3)), col)
        for i, L in enumerate(g.get('labels', [])):
            a = a0 + (a1 - a0) * i / (len(g['labels']) - 1)
            x, y = at(g['x'], g['y'], a, g['r'] - 3.6)
            text(im, L, x, y, int(K * 2.3), squeeze=0.9)
        # ícone do lado de fora do arco
        side = -1 if g['x'] < 128 else 1
        ix, iy = P(g['x'] + side * g['r'] * 0.42, g['y'] + g['r'] * 0.45)
        s = K * 1.2
        if g['kind'] == 'fuel':
            d.rectangle([ix - s, iy - s * 1.2, ix + s * 0.5, iy + s * 1.2], fill=(235, 235, 235))
        elif g['kind'] == 'volt':
            d.rectangle([ix - s * 1.4, iy - s * 0.7, ix + s * 1.4, iy + s * 0.9], outline=(235, 235, 235), width=max(1, K // 4))
        elif g['kind'] == 'water':
            d.rectangle([ix - s * 0.25, iy - s * 1.3, ix + s * 0.25, iy + s * 0.6], fill=(235, 235, 235))
            d.line([ix - s * 1.2, iy + s, ix + s * 1.2, iy + s], fill=(235, 235, 235), width=max(1, K // 4))
        else:
            d.polygon([(ix - s * 1.4, iy), (ix + s * 0.6, iy - s * 0.6), (ix + s * 1.4, iy), (ix + s * 0.6, iy + s * 0.6)], fill=(235, 235, 235))
    # moldura escura do quadro do desenho do carro (porta aberta), embaixo no meio
    a, b = P(124.5, 66)
    d.rounded_rectangle([a, b, a + 8 * K, b + 9.5 * K * PY], radius=K, fill=(22, 22, 26))
    rim = hull.filter(__import__('PIL.ImageFilter', fromlist=['MaxFilter']).MaxFilter(int(K * 1.6) | 1))
    al = np.array(rim)
    arr = np.array(im)
    edge = (al > 0) & (np.array(hull) == 0)
    arr[edge] = (16, 16, 19)
    Image.fromarray(np.dstack([arr, al]), 'RGBA').resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(out, 'nsx-cluster.png'), optimize=True)
    print('quadro', (X0, Y0), 'tamanho', (X1 - X0, Y1 - Y0), W, H)


if __name__ == '__main__':
    main()
