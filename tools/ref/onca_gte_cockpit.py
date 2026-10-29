"""Acabamento da cabine do Onça GTE (depois de import_cockpit.py br-pumagte): tira o felino da
marca real do miolo do volante (põe as letras GTE) e gera as máscaras das partes vermelhas
(colunas, moldura do para-brisa, painel das portas) para acompanharem a cor do carro.

Uso: python3 tools/ref/onca_gte_cockpit.py src/assets/cockpit
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

GLYPHS = {
    'G': ['111', '100', '101', '101', '111'],
    'T': ['111', '010', '010', '010', '010'],
    'E': ['111', '100', '110', '100', '111'],
}


def main():
    d = sys.argv[1]
    fn = os.path.join(d, 'br-pumagte-wheel.png')
    a = np.array(Image.open(fn).convert('RGBA'))
    lum = a[..., :3].astype(int).mean(axis=2)
    zone = np.zeros(a.shape[:2], bool)
    zone[104:129, 113:143] = True
    logo = zone & (lum > 120) & (a[..., 3] > 0)
    logo = cv2.dilate(logo.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    bgr = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2BGR)
    fill = cv2.inpaint(bgr, logo.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    a[logo, :3] = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB)[logo]
    x = 128 - 5
    for ch in 'GTE':  # letras prateadas
        for j, row in enumerate(GLYPHS[ch]):
            for i, v in enumerate(row):
                if v == '1':
                    a[114 + j, x + i, :3] = (226, 228, 232) if j < 3 else (160, 164, 170)
        x += 4
    Image.fromarray(a, 'RGBA').save(fn)
    # limpadores: a arte os tem levantados sobre o vidro, tapando a vista; tira e deixa as
    # palhetas estacionadas, finas, logo acima da borda vermelha do painel
    tp, dp = os.path.join(d, 'br-pumagte-top.png'), os.path.join(d, 'br-pumagte-dash.png')
    t, dd = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    c = np.vstack([t, dd])
    hsv = cv2.cvtColor(np.ascontiguousarray(c[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue = hsv[..., 0] * 360 / 256
    red = ((hue >= 340) | (hue <= 14)) & (hsv[..., 1] > 100) & (c[..., 3] > 0)
    found = {}
    for x in range(120, c.shape[1]):
        rows = np.nonzero(red[70:100, x])[0]
        if len(rows):
            found[x] = 70 + rows[0]
    # onde a borda vermelha não aparece (atrás da reconstrução do aro), interpola das vizinhas
    xs = np.array(sorted(found))
    edge = {}
    for x in range(120, c.shape[1]):
        r0 = found.get(x, int(round(np.interp(x, xs, [found[k] for k in xs]))))
        edge[x] = r0
        col = c[45:r0, x]
        col[..., 3] = 0  # acima da borda: só vidro (o céu aparece)
    for x0, x1 in ((196, 292), (304, 404)):
        for x in range(x0, x1):
            if x in edge:
                c[edge[x] - 1, x] = (34, 34, 38, 255)
    Image.fromarray(c[:t.shape[0]], 'RGBA').save(tp)
    Image.fromarray(c[t.shape[0]:], 'RGBA').save(dp)
    # partes na cor do carro: vermelho saturado
    for name in ('dash', 'top'):
        p = os.path.join(d, f'br-pumagte-{name}.png')
        im = np.array(Image.open(p).convert('RGBA'))
        hsv = cv2.cvtColor(np.ascontiguousarray(im[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
        hue = hsv[..., 0] * 360 / 256
        m = ((hue >= 340) | (hue <= 14)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 50) & (im[..., 3] > 0)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(p.replace('.png', '-mask.png'))
        print(name, 'máscara de pintura', int(m.sum()))
    print('volante: felino trocado por GTE; pixels do logotipo:', int(logo.sum()))


if __name__ == '__main__':
    main()
