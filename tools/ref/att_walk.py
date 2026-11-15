"""Animação dos frentistas (folhas do Victor: 6 quadros lado a lado sobre magenta: 4 de caminhada de lado
para a esquerda, com o bico da bomba e a mangueira saindo para trás, e 2 parado de frente acenando)
-> src/assets/people/att-<id>-walk0..3.png e att-<id>-wave0..1.png, na MESMA escala dos sprites parados
(att_sprites.py): o bloco de cada folha é a altura do quadro acenando dividida pela altura do sprite
wave daquele frentista; cada bloco vira a cor do miolo (sem borrar), pés na última linha.
Os quadros de caminhada são espelhados para olhar para a direita, como os sprites antigos (o jogo espelha
de volta: o carro fica à esquerda do frentista). Acrescenta ao atts.json [largura, altura, x de apoio]
e, na caminhada, + [x, y do bico, x, y da ponta da mangueira] (a mangueira da bomba emenda nessa ponta).
Uso: python3 tools/ref/att_walk.py <pasta com walkCity.png ... walkSnow.png> [saída=src/assets/people]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

IDS = ['City', 'Farm', 'Coast', 'Serra', 'Desert', 'Jungle', 'Snow']
POSES = ['walk0', 'walk1', 'walk2', 'walk3', 'wave0', 'wave1']


def magenta(a):
    return (a[..., 0] > 160) & (a[..., 1] < 120) & (a[..., 2] > 160)


def to_native(a, mag, P, y0, y1):
    """amostra cada bloco de P px (P não inteiro) pelo miolo; linhas ancoradas nos pés (y1)"""
    xs = np.where((~mag[y0:y1]).any(0))[0]
    x0, x1 = xs.min(), xs.max() + 1
    nrow = int(round((y1 - y0) / P))
    rows = y1 - P / 2 - np.arange(nrow)[::-1] * P
    cols = np.arange(x0 + P / 2, x1, P)
    r = max(1, int(P * 0.25))
    o = np.zeros((len(rows), len(cols), 4), np.uint8)
    for j, cy in enumerate(rows):
        for i, cx in enumerate(cols):
            yy, xx = int(cy), int(cx)
            blk = a[max(0, yy - r):yy + r + 1, max(0, xx - r):xx + r + 1].reshape(-1, 3)
            m = mag[max(0, yy - r):yy + r + 1, max(0, xx - r):xx + r + 1].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    # só o personagem (maior mancha ligada): pedaços da mangueira do quadro vizinho ficam de fora
    import cv2
    n, lab, st, _ = cv2.connectedComponentsWithStats((o[..., 3] > 0).astype(np.uint8), connectivity=8)
    if n > 2:
        big = 1 + int(np.argmax(st[1:, 4]))
        o[lab != big] = 0
    yy, xx = np.where(o[..., 3] > 0)
    return o[:, xx.min():xx.max() + 1]


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')
    mp = os.path.join(out, 'atts.json')
    meta = json.load(open(mp))
    for cid in IDS:
        a = np.array(Image.open(os.path.join(src, f'walk{cid}.png')).convert('RGB')).astype(int)
        mag = magenta(a)
        # núcleo de cada quadro: colunas com bastante desenho (a mangueira fina encosta no quadro vizinho);
        # o quadro vai até o meio do vão entre os núcleos
        cols = (~mag).sum(0) > 60
        core, s = [], None
        for x, v in enumerate(list(cols) + [False]):
            if v and s is None:
                s = x
            if not v and s is not None:
                if x - s > 40:
                    core.append((s, x))
                s = None
        assert len(core) == 6, (cid, core)
        cuts = [0] + [(core[i][1] + core[i + 1][0]) // 2 for i in range(5)] + [a.shape[1]]
        segs = []
        for i in range(6):
            x0, x1 = cuts[i], cuts[i + 1]
            xs = np.where((~mag[:, x0:x1]).sum(0) > 1)[0]
            segs.append((x0 + xs.min(), x0 + xs.max() + 1))
        boxes = []
        for x0, x1 in segs:
            ys = np.where((~mag[:, x0:x1]).sum(1) > 1)[0]
            boxes.append((ys.min(), ys.max() + 1))
        tgt = meta[f'{cid}-wave'][1]
        P = (boxes[4][1] - boxes[4][0]) / tgt
        for pose, (x0, x1), (y0, y1) in zip(POSES, segs, boxes):
            sa, sm = a[:, x0:x1], mag[:, x0:x1]
            o = to_native(sa, sm, P, y0, y1)
            if pose.startswith('walk'):
                o = o[:, ::-1].copy()  # olha para a direita, como os sprites antigos
            op = o[..., 3] > 0
            hb = max(2, int(o.shape[0] * 0.06))
            fx = np.where(op[-hb:].any(0))[0]
            foot = float((fx.min() + fx.max() + 1) / 2)
            row = [int(o.shape[1]), int(o.shape[0])]
            if pose.startswith('walk'):
                # apoio: meio do tronco (entre a cintura e os ombros, sem o bico e a mangueira), que fica
                # parado de um quadro para o outro; as pernas abertas mudariam o meio dos pés
                band = op[int(o.shape[0] * 0.18):int(o.shape[0] * 0.28)]
                bx = np.where(band.any(0))[0]
                foot = float((bx.min() + bx.max() + 1) / 2)
                # bico: coluna mais à direita na faixa das mãos (o pé da frente pode passar dele embaixo);
                # ponta da mangueira: coluna mais à esquerda na faixa da cintura (acima do pé de trás)
                H = o.shape[0]
                r0, r1 = int(H * 0.15), int(H * 0.5)
                nx = int(np.where(op[r0:r1].any(0))[0].max())
                ny = r0 + float(np.where(op[r0:r1, nx])[0].mean())
                q0, q1 = int(H * 0.3), int(H * 0.72)
                hx = int(np.where(op[q0:q1].any(0))[0].min())
                hy = q0 + float(np.where(op[q0:q1, hx])[0].mean())
                row += [round(foot, 1), nx + 0.5, round(ny, 1), hx + 0.5, round(hy, 1)]
            else:
                row += [round(foot, 1)]
            Image.fromarray(o).save(os.path.join(out, f'att-{cid}-{pose}.png'), optimize=True)
            meta[f'{cid}-{pose}'] = row
            print(cid, pose, row, 'bloco', round(P, 2))
    with open(mp, 'w') as f:
        json.dump(meta, f, indent=0)


if __name__ == '__main__':
    main()
