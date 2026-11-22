"""Máscaras de pintura (<id>-top-mask / -dash-mask) para o retrovisor externo na cor da carroceria,
nas cabines que não tinham máscara: Silber 95 (959), Cadete GSi, Fúria TR e Toro LP5.
- poly: carcaça desenhada em polígono (medido na arte); entra todo pixel opaco dentro dele (o vidro é
  transparente e fica de fora; o contorno escuro escurece na proporção do tom na repintura)
- red: peças vermelhas da arte (carcaça, capô, soleira), pelo tom (vermelho e o reflexo pêssego),
  dentro das caixas
Coordenadas no topo+painel empilhados (topo = 76 linhas), com as 102 colunas de folga.
Uso: python3 tools/ref/mirror_masks.py [id ...]"""
import sys

import numpy as np
from PIL import Image, ImageDraw

C = 'src/assets/cockpit/'
JOBS = {
    '959': {'poly': [(21, 103), (30, 100), (52, 100), (58, 104), (64, 112), (70, 121), (70, 127),
                     (61, 134), (53, 141), (30, 142), (21, 141), (20, 137)]},
    'br-kadett': {'poly': [(26, 99), (32, 92), (80, 91), (86, 95), (90, 103), (90, 137), (85, 141),
                           (30, 142), (25, 137)]},
    # retrovisor e a borda do capô vista por cima do painel
    'testarossa': {'red': [(0, 66, 37, 126), (95, 74, 460, 95)]},
    # retrovisor, a soleira vermelha da porta, o friso da coluna e a borda do capô (o couro caramelo fica: vermelho bem puro)
    'countach': {'red': [(0, 0, 110, 147), (110, 78, 460, 96)], 'pure': True},
}


def main(ids):
    for k in ids:
        job = JOBS[k]
        t, d = (np.array(Image.open(f'{C}{k}-{n}.png').convert('RGBA')) for n in ('top', 'dash'))
        st = np.concatenate([t, d])
        H, W = st.shape[:2]
        op = st[..., 3] > 0
        if 'poly' in job:
            im = Image.new('L', (W, H), 0)
            ImageDraw.Draw(im).polygon(job['poly'], fill=255)
            m = op & (np.array(im) > 0)
        else:
            a = st[..., :3].astype(int)
            r, g, b = a[..., 0], a[..., 1], a[..., 2]
            red = (r > g + 25) & (r > b + 15)
            if job.get('pure'):
                red &= (r > g * 1.9) & (g - b < 30)   # laranja e caramelo têm o verde bem acima do azul
            peach = (r > 200) & (g > 140) & (b < g) & (r > b + 50) & (not job.get('pure'))
            yy, xx = np.mgrid[:H, :W]
            box = np.zeros((H, W), bool)
            for x0, y0, x1, y1 in job['red']:
                box |= (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
            m = op & (red | peach) & box
        out = np.zeros((H, W), np.uint8)
        out[m] = 255
        Image.fromarray(out[:t.shape[0]], 'L').save(f'{C}{k}-top-mask.png', optimize=True)
        Image.fromarray(out[t.shape[0]:], 'L').save(f'{C}{k}-dash-mask.png', optimize=True)
        print(k, int(m.sum()), 'pixels')


if __name__ == '__main__':
    main(sys.argv[1:] or list(JOBS))
