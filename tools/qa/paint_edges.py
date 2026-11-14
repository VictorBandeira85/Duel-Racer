"""Restos da cor de fábrica nas peças pintadas (lataria, molduras de retrovisor, capô) de TODOS os carros
atualizados: pixels fora da máscara de pintura, colados nela (até 2 px), com o matiz da cor de fábrica
e em grupos pequenos (lanternas, piscas e emblemas são manchas grandes e ficam de fora). Com outra cor
eles aparecem como pontos laranja/vermelhos na borda da peça (ex.: moldura do retrovisor do GTI prata).
Uso: python3 tools/qa/paint_edges.py <saída_dir> [--fix] [alvo ...]
  alvo: 'cab:<id>' (cabine, máscaras top/dash) ou '<arte>' (sprites side/front/rear/front-up)
  --fix acrescenta os pixels à máscara. Folha: a vista repintada de azul, antes e depois, com os
  pixels achados marcados em magenta.
"""
import colorsys
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
COCK = os.path.join(ROOT, 'src/assets/cockpit')
CARS = os.path.join(ROOT, 'src/assets/cars')
CABS = ['viper', 'diablo', 'f40', 'nsx', 'br-golgti', 'br-monza', 'br-passat', 'br-pumagte']
ARTS = ['viper', 'diablo', 'diablosv', 'testarossa', 'f40', 'nsx', 'br-golgti', 'br-monza', 'br-monzacoupe',
        'br-voyage', 'br-voyagesport', 'br-santana', '959', 'countach', 'br-passat', 'br-pumagte']


def hsv(a):
    rgb = a[..., :3].astype(np.float32) / 255
    h = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    return h[..., 0] * 360 / 256, h[..., 1] / 255, h[..., 2] / 255


def grow(m, n):
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0


def find(a, m):
    """pixels a acrescentar à máscara m"""
    op = a[..., 3] > 0
    H, S, V = hsv(a)
    inm = m & op & (S > 0.35) & (V > 0.2)
    if inm.sum() < 50:
        return np.zeros(m.shape, bool), None
    # matiz de fábrica: média circular dos pixels saturados da máscara
    ang = np.deg2rad(H[inm])
    h0 = (np.rad2deg(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) + 360) % 360
    dh = np.abs((H - h0 + 180) % 360 - 180)
    like = op & ~m & (dh < 26) & (S > 0.35) & (V > 0.12)
    n, lab, st, _ = cv2.connectedComponentsWithStats(like.astype(np.uint8), connectivity=8)
    near = grow(m, 2)
    add = np.zeros(m.shape, bool)
    for i in range(1, n):
        c = lab == i
        if st[i, 4] > 6:
            # mancha maior: só entra se for traço fino e escuro (contorno/sombra da lataria, até 60 px);
            # lanterna, emblema e letreiro são manchas cheias e vivas
            w, h = st[i, 2], st[i, 3]
            line = min(w, h) <= 2  # friso de 1-2 px na borda da lataria (qualquer comprimento)
            sparse = st[i, 4] < 0.45 * w * h and st[i, 4] <= 60 and V[c].mean() <= 0.45
            if not (line or sparse):
                continue
        if not (c & near).any():
            continue
        # grupo pequeno colado na lataria pintada: vizinhança tem de ser bem mais máscara do que outra coisa colorida
        rg = grow(c, 1) & ~c & op
        if rg.sum() and (m[rg].mean() < (0.4 if st[i, 4] > 6 else 0.25)):
            continue
        add |= c
    return add, h0


def paint_blue(a, m):
    o = a.copy()
    V = a[..., :3].max(-1).astype(np.float32) / 255
    blue = np.array([40, 90, 230], np.float32)
    o[m, :3] = np.clip(blue * (0.35 + V[m][:, None] * 0.9), 0, 255).astype(np.uint8)
    return o


def sheet(rows, path, k=4):
    ims = []
    for a, m, add in rows:
        before = paint_blue(a, m)
        mark = before.copy()
        mark[add, :3] = (255, 0, 255)
        after = paint_blue(a, m | add)
        for arr in (mark, after):
            im = Image.fromarray(arr, 'RGBA')
            bg = Image.new('RGBA', im.size, (70, 80, 95, 255))
            bg.alpha_composite(im)
            ims.append(bg.resize((im.width * k, im.height * k), Image.NEAREST))
    W = max(i.width for i in ims)
    o = Image.new('RGB', (W, sum(i.height for i in ims)), (70, 80, 95))
    y = 0
    for i in ims:
        o.paste(i, (0, y))
        y += i.height
    o.save(path)


def save_mask(mp, m):
    im = Image.open(mp)
    arr = np.array(im.convert('L'))
    arr[m] = 255
    Image.fromarray(arr, 'L').convert(im.mode).save(mp, optimize=True)


def run(tg, out, fix):
    if tg.startswith('cab:'):
        cid = tg[4:]
        parts = [(os.path.join(COCK, f'{cid}-{k}.png'), os.path.join(COCK, f'{cid}-{k}-mask.png')) for k in ('top', 'dash')]
    else:
        parts = [(os.path.join(CARS, f'{tg}-{v}.png'), os.path.join(CARS, f'{tg}-{v}-mask.png')) for v in ('side', 'front', 'rear', 'front-up', 'side-up')]
    rows, total = [], 0
    for ip, mp in parts:
        if not (os.path.exists(ip) and os.path.exists(mp)):
            continue
        a = np.array(Image.open(ip).convert('RGBA'))
        m = np.array(Image.open(mp).convert('L')) > 127
        if m.shape != a.shape[:2]:
            continue
        add, h0 = find(a, m)
        n = int(add.sum())
        total += n
        if n:
            rows.append((a, m, add))
            print(f'  {os.path.basename(ip)}: {n} px (matiz {h0:.0f})')
            if fix:
                save_mask(mp, add)
    if rows:
        sheet(rows, os.path.join(out, tg.replace(':', '_') + '.png'))
    return total


def main():
    args = sys.argv[1:]
    fix = '--fix' in args
    args = [x for x in args if x != '--fix']
    out = args[0]
    os.makedirs(out, exist_ok=True)
    tgs = args[1:] or [f'cab:{c}' for c in CABS] + ARTS
    for tg in tgs:
        print(f'{tg}: {run(tg, out, fix)} px')


if __name__ == '__main__':
    main()
