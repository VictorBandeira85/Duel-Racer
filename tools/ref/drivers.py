"""Motoristas dentro dos carros (folhas do Victor, etapa "MOTORISTAS DENTRO DOS CARROS"): cada folha, em
fundo magenta #FF00FF, traz 3 vistas da cintura para cima: de costas (com o encosto do banco), de frente
(mãos no volante) e de perfil virado para a esquerda (braço no volante, banco atrás).
Saída: src/assets/people/drv-<id>-<back|front|side>.png em pixel art nativa (bloco fixo de P px da folha,
cor do miolo de cada bloco, sem borrar; magenta vira transparente) e src/assets/people/drivers.json com,
por vista: [largura, altura, x do meio da cabeça, largura da cabeça, largura dos ombros, linha dos ombros]
(o jogo escala o motorista pela largura da cabeça e o põe pelo meio da cabeça; o topo é a linha 0).
Uso: python3 tools/ref/drivers.py [pasta das folhas] [saída=src/assets/people]
As folhas: drvRival.png drvMan.png drvWoman.png drvOld.png drvYoung.png (ou os uploads originais, ver SHEETS).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

IDS = ['rival', 'man', 'woman', 'old', 'young']
VIEWS = ['back', 'front', 'side']
# uploads originais (nomes das folhas no envio do Victor), usados se a pasta não tiver drv<Id>.png
SHEETS = {'rival': '47887809', 'man': '6b72ce66', 'woman': 'eaf6942a', 'old': 'd7c595c6', 'young': '83b5ea14'}
P = 8.0  # bloco fixo (a grade das folhas é irregular, como nas dos policiais): todos na mesma escala


def magenta(a):
    return (a[..., 0] > 160) & (a[..., 1] < 120) & (a[..., 2] > 160)


def to_native(a, mag):
    ys, xs = np.where(~mag)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rows = np.arange(y0 + P / 2, y1, P)
    cols = np.arange(x0 + P / 2, x1, P)
    r = 2
    o = np.zeros((len(rows), len(cols), 4), np.uint8)
    for j, cy in enumerate(rows):
        for i, cx in enumerate(cols):
            yy, xx = int(cy), int(cx)
            blk = a[yy - r:yy + r, xx - r:xx + r].reshape(-1, 3)
            m = mag[yy - r:yy + r, xx - r:xx + r].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    # pixel solto (franja de magenta misturado): sai
    al = o[..., 3] > 0
    for j in range(o.shape[0]):
        for i in range(o.shape[1]):
            if not al[j, i]:
                continue
            n = al[max(0, j - 1):j + 2, max(0, i - 1):i + 2].sum() - 1
            px = o[j, i, :3].astype(int)
            pinkish = px[0] > 150 and px[2] > 130 and px[1] < 110
            if n <= 1 or (pinkish and n < 8):
                o[j, i] = 0
    yy, xx = np.where(o[..., 3] > 0)
    return o[yy.min():yy.max() + 1, xx.min():xx.max() + 1]


def segments(mag):
    cols = (~mag).sum(0) > 2
    segs, s = [], None
    for x, v in enumerate(list(cols) + [False]):
        if v and s is None:
            s = x
        if not v and s is not None:
            if x - s > 60:
                segs.append((s, x))
            s = None
    return segs


def metrics(o, view):
    al = o[..., 3] > 0
    h, w = al.shape
    # cabeça: linhas entre 22% e 32% da altura (abaixo da aba do chapéu/boné, acima dos ombros)
    ws, cs = [], []
    for y in range(int(h * 0.22), int(h * 0.32) + 1):
        xs = np.where(al[y])[0]
        if len(xs):
            # o trecho opaco contínuo mais largo da linha (de perfil, o banco atrás fica de fora)
            runs, s0 = [], xs[0]
            for a, b in zip(xs, list(xs[1:]) + [None]):
                if b is None or b != a + 1:
                    runs.append((s0, a + 1))
                    if b is not None:
                        s0 = b
            r0, r1 = max(runs, key=lambda r: r[1] - r[0])
            ws.append(r1 - r0)
            cs.append((r0 + r1) / 2)
    head_w = float(np.median(ws))
    head_cx = float(np.median(cs))
    # ombros: a linha mais larga entre 40% e 75%
    widths = [(al[y].sum(), y) for y in range(int(h * 0.4), int(h * 0.75))]
    sw, sy = max(widths)
    out = [int(w), int(h), round(head_cx, 1), round(head_w, 1), int(sw), int(sy)]
    if view == 'side':
        # banco atrás (à direita): pixels cinzentos sem cor; o encosto de cabeça é a parte de cima dele.
        # Na lateral do carro o banco da arte fica e o da folha sai (colunas a partir de cut)
        rgb = o[..., :3].astype(int)
        gray = al & (np.abs(rgb[..., 0] - rgb[..., 2]) < 18) & (np.abs(rgb[..., 0] - rgb[..., 1]) < 18) & (rgb[..., 0] > 35) & (rgb[..., 0] < 125)
        gray[:, :int(w * 0.74)] = False
        ys, xs = np.where(gray)
        low = ys > h * 0.68
        cut = int(np.percentile(xs[low], 5)) - 1  # encosto: começa logo atrás das costas
        up = ys < h * 0.6
        hy, hx = ys[up], xs[up]
        out += [round(float((hx.min() + hx.max() + 1) / 2), 1), int(hy.min()), int(hy.max() - hy.min() + 1), cut]
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    src = sys.argv[1] if len(sys.argv) > 1 else '/root/.claude/uploads/70550d6c-f02a-5bf5-8dc5-08a6ba2cd137'
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', '..', 'src/assets/people')
    meta = {}
    for did in IDS:
        f = os.path.join(src, f'drv{did.capitalize()}.png')
        if not os.path.exists(f):
            f = os.path.join(src, f'{SHEETS[did]}-image.png')
        a = np.array(Image.open(f).convert('RGB')).astype(int)
        mag = magenta(a)
        segs = segments(mag)
        assert len(segs) == 3, (did, segs)
        for view, (x0, x1) in zip(VIEWS, segs):
            o = to_native(a[:, max(0, x0 - 4):x1 + 4], mag[:, max(0, x0 - 4):x1 + 4])
            name = f'drv-{did}-{view}'
            Image.fromarray(o).save(os.path.join(out, name + '.png'), optimize=True)
            meta[f'{did}-{view}'] = metrics(o, view)
            print(name, meta[f'{did}-{view}'])
    with open(os.path.join(out, 'drivers.json'), 'w') as fh:
        json.dump(meta, fh, separators=(',', ':'))


if __name__ == '__main__':
    main()
