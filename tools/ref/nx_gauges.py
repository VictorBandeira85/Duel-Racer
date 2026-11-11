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

K = 12                      # desenha o fundo em 12 px por pixel do jogo e reduz para KO: traços suavizados
KO = 4                      # resolução final = a do jogo (RES 4; e outra versão em 2 para RES 2): sem reamostrar no jogo
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


LABELS = []  # números e textos: desenhados depois, direto na resolução final (letras nítidas)


def label(s, cx, cy, size, track=0.0):
    LABELS.append((s, cx * KO / K, cy * KO / K, size * KO / K, track))


# fonte de pixels 3x5 para a versão de baixa resolução (2 px por pixel do jogo): números
# pequenos ficam nítidos em vez de borrões ("1" com 1 coluna)
PIXFONT = {
    '0': ['111', '101', '101', '101', '111'], '1': ['1', '1', '1', '1', '1'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'], '½': ['100', '000', '111', '011', '110'],
}


# algarismos do quadro do NSX (conferidos na foto ampliada): largos e quadrados, de cantos bem
# arredondados e traço médio (família Microgramma/Eurostile), desenhados à mão numa caixa 5 x 6
NXD = {
    '0': [[(0, 0), (5, 0), (5, 6), (0, 6), (0, 0), (5, 0)]],
    '1': [[(1.2, 1.3), (2.8, 0), (2.8, 6)]],
    '2': [[(0, 0), (5, 0), (5, 3), (0, 3), (0, 6), (5, 6)]],
    '3': [[(0, 0), (5, 0), (5, 6), (0, 6)], [(1.6, 3), (5, 3)]],
    '4': [[(3.6, 6), (3.6, 0), (0, 4.2), (5, 4.2)]],
    '5': [[(5, 0), (0, 0), (0, 2.8), (5, 2.8), (5, 6), (0, 6)]],
    '6': [[(5, 0), (0, 0), (0, 6), (5, 6), (5, 2.8), (0, 2.8)]],
    '7': [[(0, 0), (5, 0), (2, 6)]],
    '8': [[(0, 0), (5, 0), (5, 6), (0, 6), (0, 0), (5, 0)], [(0, 2.9), (5, 2.9)]],
    '9': [[(5, 3.2), (0, 3.2), (0, 0), (5, 0), (5, 6), (0, 6)]],
}
NXW = {'1': 3.4}


def fillet(path, r=1.25, n=5):
    """arredonda os cantos de 90° do traçado (raio r)"""
    out = [path[0]]
    for a, b, c in zip(path, path[1:], path[2:]):
        v1 = np.array(a, float) - b
        v2 = np.array(c, float) - b
        l1, l2 = np.hypot(*v1), np.hypot(*v2)
        if l1 < 1e-6 or l2 < 1e-6 or abs(np.dot(v1, v2)) > 0.2 * l1 * l2:
            out.append(b)
            continue
        rr = min(r, l1 / 2, l2 / 2)
        p1, p2 = b + v1 / l1 * rr, b + v2 / l2 * rr
        for t in np.linspace(0, 1, n):
            out.append(tuple((1 - t) ** 2 * p1 + 2 * t * (1 - t) * np.array(b, float) + t * t * p2))
    out.append(path[-1])
    return out


def nx_number(s, h, col=(246, 246, 246), bold=1.0):
    S = 8
    u = h * S / 6.9
    t = u * 0.95 * bold
    gap = u * 1.5
    ws = [NXW.get(ch, 5) * u for ch in s]
    w = int(sum(ws) + gap * (len(s) - 1) + t * 2)
    lay = Image.new('L', (w, int(u * 6 + t * 2)), 0)
    dd = ImageDraw.Draw(lay)
    ox = t
    for ch, cw in zip(s, ws):
        for path in NXD[ch]:
            pts = [(ox + x * u - (0.8 * u if ch == '1' else 0), t + y * u) for x, y in fillet(path)]
            dd.line(pts, fill=255, width=int(t), joint='curve')
            for x, y in (pts[0], pts[-1]):
                dd.ellipse([x - t / 2, y - t / 2, x + t / 2, y + t / 2], fill=255)
        ox += cw + gap
    lay = lay.resize((max(1, w // S), max(1, lay.height // S)), Image.LANCZOS)
    img = Image.new('RGBA', lay.size, col + (0,))
    img.putalpha(lay)
    return img


def draw_labels(im):
    d = ImageDraw.Draw(im)
    for s, cx, cy, size, track in LABELS:
        if KO == 4 and track > 50 and all(ch in NXD for ch in s):  # track > 50: número no estilo do NSX, size = altura
            g = nx_number(s, size, bold=1.45 if size > 11 else 1.5)
            if len(s) > 2:
                g = g.resize((max(1, int(g.width * 0.8)), g.height), Image.LANCZOS)
            im.alpha_composite(g, (int(round(cx - g.width / 2)), int(round(cy - g.height / 2))))
            continue
        if track > 50:
            track = -0.5
        if KO == 2 and size < 9:
            if not all(ch in PIXFONT for ch in s):
                continue  # textos pequenos (km/h, x1000r/min) não cabem em 2 px por pixel
            tw = sum(len(PIXFONT[ch][0]) for ch in s) + len(s) - 1
            x, y = int(round(cx - tw / 2)), int(round(cy - 2.5))
            for ch in s:
                for j, row in enumerate(PIXFONT[ch]):
                    for i, v in enumerate(row):
                        if v == '1':
                            im.putpixel((x + i, y + j), (246, 246, 246, 255))
                x += len(PIXFONT[ch][0]) + 1
            continue
        f = ImageFont.truetype(FONT, int(round(size)))
        ws = [d.textlength(ch, font=f) for ch in s]
        tw = sum(ws) + track * (len(s) - 1)
        x = round(cx - tw / 2)
        for ch, w in zip(s, ws):
            d.text((x, round(cy)), ch, font=f, fill=(246, 246, 246, 255), anchor='lm')
            x += w + track


def text(im, s, cx, cy, size, col=(244, 244, 244), squeeze=0.9):
    f = ImageFont.truetype(FONT, size)
    d0 = ImageDraw.Draw(Image.new('L', (4, 4)))
    x0, y0, x1, y1 = d0.textbbox((0, 0), s, font=f)
    lay = Image.new('L', (x1 - x0 + 4, y1 - y0 + 4), 0)
    ImageDraw.Draw(lay).text((2 - x0, 2 - y0), s, font=f, fill=255)
    lay = lay.resize((max(1, int(lay.width * squeeze)), lay.height), Image.LANCZOS)
    im.paste(col, (int(cx - lay.width / 2), int(cy - lay.height / 2)), lay)


def main():
    global KO
    out = sys.argv[1]
    for KO in (4, 2):
        LABELS.clear()
        build(out)


def build(out):
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
        ell(d, g['x'], g['y'], g['r'], fill=(27, 26, 27))
        fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
        if red is not None:  # bloco vermelho de 8 a 9 por dentro das marcações
            for k in range(60):
                v = red + (g['max'] - red) * k / 59
                tick(d, g, fr(v), g['r'] - 4.4, g['r'] - 2.1, int(K * 0.9), (226, 34, 24))
        # marcações finas e cheias em toda a volta (como na foto): conta-giros de 100 em 100 rpm,
        # velocímetro de 2 em 2 km/h; as do meio mais compridas e as dos números compridas e grossas
        minor, mid = (0.1, 0.5) if g is TACH else (2, 10)
        n = int(round(g['max'] / minor))
        for i in range(n + 1):
            v = i * minor
            if any(abs(v - L) < 1e-6 for L in labels):
                tick(d, g, fr(v), g['r'] - 3.6, g['r'] - 0.7, int(K * 0.5))
            elif abs(v / mid - round(v / mid)) < 1e-6:
                tick(d, g, fr(v), g['r'] - 2.7, g['r'] - 0.7, int(K * 0.3))
            else:
                tick(d, g, fr(v), g['r'] - 1.9, g['r'] - 0.7, int(K * 0.2))
        for L in labels:
            x, y = at(g['x'], g['y'], fr(L), g['r'] - (7.2 if g is TACH else 6.4 + (1.3 if L >= 100 else 0)))
            label(str(L), x, y, K * (4.0 if g is TACH else 2.5), track=99)
        x, y = P(g['x'], g['y'] + g['r'] * 0.62 * PY)
        label('x1000r/min' if g is TACH else 'km/h', x + (K * 3 if g is TACH else 0), y, K * 1.9, track=0)
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
            label(L, x, y, K * 2.5, track=-0.5)
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
    # hodômetros de cristal líquido no alumínio, embaixo (total à esquerda, parcial à direita): no carro
    # de verdade ficam fora dos mostradores
    for (x, y, w_, h_) in [(73.5, 78, 15, 4.5), (169.5, 78, 10, 4.5)]:
        a, b = P(x, y)
        d.rounded_rectangle([a, b, a + w_ * K, b + h_ * K], radius=K * 0.6, fill=(20, 21, 22))
    # moldura escura do quadro do desenho do carro (porta aberta), embaixo no meio
    a, b = P(124.5, 66)
    d.rounded_rectangle([a, b, a + 8 * K, b + 9.5 * K * PY], radius=K, fill=(22, 22, 26))
    rim = hull.filter(__import__('PIL.ImageFilter', fromlist=['MaxFilter']).MaxFilter(int(K * 1.6) | 1))
    al = np.array(rim)
    arr = np.array(im)
    edge = (al > 0) & (np.array(hull) == 0)
    arr[edge] = (16, 16, 19)
    fin = Image.fromarray(np.dstack([arr, al]), 'RGBA').resize((W * KO // K, H * KO // K), Image.LANCZOS)
    draw_labels(fin)
    fin.save(os.path.join(out, 'nsx-cluster.png' if KO == 4 else 'nsx-cluster-2x.png'), optimize=True)
    print('quadro', (X0, Y0), 'tamanho', (X1 - X0, Y1 - Y0), W, H)


if __name__ == '__main__':
    main()
