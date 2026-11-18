"""Trânsito novo com a arte do Victor (folha 1536 x 1024 sobre magenta: traseira à esquerda, frente à
direita) virando os sprites do jogo (src/assets/traffic/<modelo>-<vista>.png + -mask.png). Reaproveita o
recorte de tools/ref/truck_art.py (cor do miolo de cada bloco, paleta curta, contorno roxo vira preto):
- carros: cada vista com 160 px de largura (retrovisores inclusos), como os do traffic_art.py; máscara de
  pintura no vermelho da lataria, sem lanternas (grupos vermelhos pequenos e soltos nos cantos de baixo,
  cercados de contorno), piscas, faróis, para-choques, vidros e placa;
- grandes (caminhão baú e ônibus): escala única por folha, carroceria da vista mais larga com 160 px
  (TRUCK_W); retrovisores passam disso (TRUCK_PX em src/race.ts). Ônibus ficam com a pintura da arte
  (sem máscara); o baú pinta só a cabine, de frente.
Uso: python3 tools/ref/traffic_sheets.py <modelo>=<folha> ...   (PREVIEW=<pasta> grava a conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from truck_art import OUT, body_width, boxes, lamps, palette, plate, red_mask, reduce, views  # noqa: E402

BIG = {'bau', 'rodoviario', 'micro', 'leito'}
NOPAINT = {'rodoviario', 'micro', 'leito'}
W = 160
# caixas (pixels do sprite) que nunca entram na máscara: peças vermelhas que não são lataria
EXCL = {
    ('jipe', 'rear'): [(10, 89, 26, 113), (134, 89, 151, 113)],  # lanternas (encostam na lataria)
    ('corcel', 'rear'): [(55, 71, 105, 85)],  # faixa da lanterna que atravessa a tampa
}
EXCL_BIG = {'bau': [(0, 0, 999, 12)]}  # luzes vermelhas do alto do baú, acima da cabine


# vistas em que a lataria vem em pedacinhos (jipe de trás: estepe e dobradiças cortam tudo): o vermelho
# da caixa inteira, menos as caixas de EXCL
SIMPLE = {('jipe', 'rear'): (0, 74, 160, 134)}
# saia vermelha embaixo do para-choque, mais escura que a lataria: entra pelo vermelho da caixa
ADD = {('delrey', 'front'): (0, 98, 160, 128), ('delrey', 'rear'): (0, 100, 160, 134), ('corcel', 'rear'): (0, 95, 160, 126),
       ('saveiro', 'front'): (0, 70, 160, 98)}


def car_mask(o, rear, excl=(), simple=None):
    H, Wd = o.shape[:2]
    if simple:
        from truck_art import hsv
        h, s, v = hsv(o)
        dh = np.abs((h - 4 + 180) % 360 - 180)
        return (o[..., 3] > 0) & boxes(H, Wd, [simple]) & ~boxes(H, Wd, list(excl)) & (dh < 18) & (s > 0.4) & (v > 0.2)
    m = red_mask(o, ~boxes(H, Wd, list(excl)))
    # lanternas vermelhas: grupos menores que 6% da máscara, nos lados, na metade de baixo
    n, lab, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
    tot = m.sum()
    out = np.zeros_like(m)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        cx, cy = cen[i]
        side = cx < Wd * 0.34 or cx > Wd * 0.66
        if a < tot * 0.06 and side and cy > H * 0.4:
            out |= lab == i
    # a arte é simétrica: a lanterna achada de um lado também sai do outro (às vezes ela encosta na
    # lataria e passa junto com ela)
    out |= cv2.dilate(out[:, ::-1].astype(np.uint8), np.ones((1, 3), np.uint8)) > 0  # arte nem sempre centrada no pixel
    return m & ~out


def main():
    prev = os.environ.get('PREVIEW')
    for arg in sys.argv[1:]:
        model, path = arg.split('=', 1)
        a = np.array(Image.open(path).convert('RGB')).astype(int)
        vb = views(a)
        big = model in BIG
        if big:
            bw = [body_width(a, b) for b in vb]
            scales = [max(bw) / W] * 2
        else:
            scales = [(b[2] - b[0]) / W for b in vb]
        for view, box, bs in zip(('rear', 'front'), vb, scales):
            o = palette(reduce(a, box, bs))
            H, Wd = o.shape[:2]
            if model in NOPAINT or (big and view == 'rear'):
                m = np.zeros((H, Wd), bool)
            elif big:
                m = red_mask(o, ~boxes(H, Wd, EXCL_BIG.get(model, [])))
            else:
                m = car_mask(o, view == 'rear', EXCL.get((model, view), ()), SIMPLE.get((model, view)))
                if (model, view) in ADD:
                    m |= car_mask(o, view == 'rear', (), ADD[(model, view)])
            name = f'{model}-{view}'
            Image.fromarray(o).save(os.path.join(OUT, name + '.png'), optimize=True)
            mp = os.path.join(OUT, name + '-mask.png')
            if m.any():
                Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(mp, optimize=True)
            elif os.path.exists(mp):
                os.remove(mp)
            if prev:  # conferência: arte, repintada de azul e máscara, ampliadas 3x
                blue = o.copy()
                lum = o[..., :3].astype(float) @ [0.3, 0.59, 0.11] / 255
                blue[m, :3] = np.stack([lum * 60, lum * 120, lum * 320], -1)[m].clip(0, 255)
                mk = np.zeros_like(o)
                mk[..., 3] = 255
                mk[m, :3] = 255
                strip = np.concatenate([o, blue, mk], 1)
                bg = np.zeros((*strip.shape[:2], 3), np.uint8) + 90
                al = strip[..., 3:] / 255
                img = (strip[..., :3] * al + bg * (1 - al)).astype(np.uint8)
                Image.fromarray(img).resize((img.shape[1] * 3, img.shape[0] * 3), Image.NEAREST).save(os.path.join(prev, name + '.png'))
            body = round((body_width(a, box)) / bs)
            print(name, Wd, 'x', H, 'carroceria', body, 'máscara', int(m.sum()),
                  'luzes', lamps(o, view == 'rear'), 'placa', plate(o, view == 'rear'))


if __name__ == '__main__':
    main()
