"""Patrulha 9C (Chevrolet Caprice 9C1) com a arte nova do Victor (lateral, traseira e frente com cenário):
recorte por grabCut (patrol_cut.py: mato, acostamento e serras como fundo certo; sombra do chão fora, só os
pneus abaixo da linha deles), marcas reais fora (gravatas da grade e da tampa viram o emblema da Vanguarda;
"GOODYEAR" dos pneus vira borracha lisa) e pixel art nítida (shrink de monza_sprites.py: lateral 400,
frente/traseira 260). O POLICE, o escudo ROUTE 28, o número e o DIAL 911 ficam (não são marca).
Giroflex da lateral (pedido do Victor): a arte trazia a barra inteira em diagonal; vista de lado, a barra
(atravessada no teto) só mostra a ponta esquerda: a lente VERMELHA, do tamanho real dela (a fundura da barra,
~30 cm), sobre a base preta e o pé no meio do teto. A barra da arte sai.
Uso: python3 tools/ref/patrol_sprites2.py <pasta com side/rear/front.png> <src/assets/cars>
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import stamp  # noqa: E402
import patrol_cut  # noqa: E402

WIDTH = {'side': 400, 'rear': 260, 'front': 260}
BADGE = {'rear': (840, 487, 10), 'front': (838, 582, 11)}       # gravatas (centro na arte, lado no sprite)
TIRES = [(375, 455, 106), (1270, 455, 106)]                      # lateral: centro e raio do pneu (letreiro na borda)
BAR = (800, 228, 1075, 300)                                       # giroflex da lateral (caixa na arte)


def main():
    src, out = sys.argv[1], sys.argv[2]
    patrol_cut.Z = src.rstrip('/') + '/'
    for k in ('side', 'rear', 'front'):
        a, car = patrol_cut.cut(k)
        a = a.copy()
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        if k == 'side':
            for cx, cy0, rr in TIRES:   # borracha lisa no anel de fora do pneu (letreiro some)
                cy = cy0 + 200
                d = np.hypot(xx - cx, yy - cy)
                ring = (d > rr * 0.72) & (d < rr * 0.98) & car
                light = ring & (a.astype(int).mean(axis=2) > 70)
                a[light] = np.median(a[ring & ~light].reshape(-1, 3), axis=0).astype(np.uint8)
            x0, y0, x1, y1 = BAR
            # o teto embaixo da barra: o que não é teto (acima da linha do teto) sai
            roof = np.full(a.shape[1], 10 ** 6)
            for x in range(x0, x1):
                col = car[y1:y1 + 60, x] & (a[y1:y1 + 60, x].astype(int).mean(axis=1) > 150)
                ys = np.nonzero(col)[0]
                if len(ys):
                    roof[x] = y1 + ys[0]
            for x in range(x0, x1):
                if roof[x] < 10 ** 6:
                    car[y0 - 10:roof[x] - 3, x] = False
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))  # noqa: E731
        if k in BADGE:
            bx, by, size = BADGE[k]
            sx, sy = to_s(bx, by)
            s[sy - size // 2 - 1:sy + size // 2 + 2, sx - size // 2 - 1:sx + size // 2 + 2, :3] = s[sy - size // 2 - 3, sx, :3]
            stamp(s, None, 'vanguarda', (sx, sy, size, 0))
        if k == 'side':
            # ponta vermelha do giroflex: 22 x 10 px, base preta e o pé no meio do teto
            PAD = 14   # linhas livres em cima para a ponta do giroflex
            s = np.concatenate([np.zeros((PAD, s.shape[1], 4), np.uint8), s], axis=0)
            oy -= PAD * f
            cx = to_s(938, 0)[0]
            col = np.nonzero(s[:, cx, 3] > 0)[0]
            roof_y = col[0]
            # contorno escuro do teto onde a barra da arte saiu
            for xs_ in range(to_s(BAR[0], 0)[0] - 1, to_s(BAR[2], 0)[0] + 2):
                op = np.nonzero(s[:, xs_, 3] > 0)[0]
                if len(op):
                    s[op[0], xs_] = (18, 18, 22, 255)
            w, h = 22, 10
            L, B = cx - w // 2, roof_y - 3
            s[B:roof_y, cx - 3:cx + 3] = (26, 26, 30, 255)                   # pé
            s[B - 2:B, L - 1:L + w + 1] = (20, 20, 24, 255)                  # base
            s[B - 2 - h:B - 2, L - 1:L + w + 1] = (14, 10, 12, 255)          # contorno
            s[B - 1 - h:B - 3, L:L + w] = (200, 24, 22, 255)                 # lente
            s[B - 1 - h:B - 1 - h + 3, L + 1:L + w - 1] = (255, 96, 80, 255) # brilho de cima
            s[B - 5:B - 3, L:L + w] = (140, 14, 14, 255)                     # sombra de baixo
            for i in range(L + 4, L + w - 2, 6):
                s[B - 1 - h + 3:B - 5, i:i + 1] = (232, 52, 44, 255)          # gomos da lente
            print('  giroflex (sprite):', L, B - 1 - h, L + w, B - 3, 'teto', roof_y)
        # fiapos de 1-2 px soltos (trilho do guard-rail, beira da sombra): opaco sem vizinho em cima e embaixo
        al = s[..., 3] > 0
        for _ in range(2):
            up = np.zeros_like(al); up[1:] = al[:-1]
            dn = np.zeros_like(al); dn[:-1] = al[1:]
            up2 = np.zeros_like(al); up2[2:] = al[:-2]
            dn2 = np.zeros_like(al); dn2[:-2] = al[2:]
            thin = al & ~(up & up2) & ~(dn & dn2) & ~(up & dn)
            s[thin] = 0
            al = s[..., 3] > 0
        if k == 'front':   # pontas do trilho ao lado dos retrovisores
            s[:95, :9] = 0
            s[:95, -9:] = 0
        if k == 'side':    # embaixo da carroceria, só os pneus
            H_, W_ = s.shape[:2]
            yy2, xx2 = np.mgrid[0:H_, 0:W_]
            keep = np.zeros((H_, W_), bool)
            for cx, cy0, rr in TIRES:
                keep |= np.hypot(xx2 - (cx - ox) / f, yy2 - (cy0 + 200 - oy) / f) <= rr / f + 1.5
            s[(yy2 > H_ - 20) & ~keep] = 0
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'patrol-{k}.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'fator', round(f, 3))
        if k == 'side':
            print('  rodas (u,v):', [((cx - ox) / f / s.shape[1], (cy0 + 200 - oy) / f / s.shape[0]) for cx, cy0, _ in TIRES])
        if k == 'rear':
            print('  placa:', *to_s(762, 535), *to_s(915, 608), s.shape[1], s.shape[0], 'lanterna', [(round((x - ox) / f / s.shape[1], 3), round((y - oy) / f / s.shape[0], 3)) for x, y in ((470, 540), (1210, 540))])
        if k == 'front':
            print('  farol:', [(round((x - ox) / f / s.shape[1], 3), round((y - oy) / f / s.shape[0], 3)) for x, y in ((520, 570), (448, 572))])


if __name__ == '__main__':
    main()
