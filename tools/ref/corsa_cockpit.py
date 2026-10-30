"""Acabamento da cabine do Corsário GSi (depois de import_cockpit.py br-corsa e de
gtb_rim_fix.py ... ceu):
- volante: a gravata da marca no miolo sai; no disco preto fica o emblema fictício (anel
  cromado com traços de velocidade)
- faixa do aro antigo: a média puxou o vermelho das luzes-espia do quadro; volta a cinza
- linha branca entre o painel e o para-brisa (fundo da arte entre as palhetas): transparente
- luzes-espia do quadro (vinham acesas na arte): viram o fundo escuro, o jogo as acende

Uso: python3 tools/ref/corsa_cockpit.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image


def main():
    d = sys.argv[1]
    wp, dp, tp = (os.path.join(d, f'br-corsa-{k}.png') for k in ('wheel', 'dash', 'top'))
    w = np.array(Image.open(wp).convert('RGBA'))
    a = np.array(Image.open(dp).convert('RGBA'))
    t = np.array(Image.open(tp).convert('RGBA'))
    # emblema do volante (disco elíptico: o miolo é visto um pouco de baixo)
    cx, cy, sx, sy = 127.0, 111.0, 1.0, 1.08
    yy, xx = np.mgrid[0:w.shape[0], 0:w.shape[1]]
    dd = np.sqrt(((xx + 0.5 - cx) / sx) ** 2 + ((yy + 0.5 - cy) / sy) ** 2)
    w[dd <= 13.5, :3] = (12, 12, 14)
    chrome = (dd <= 9.2) & (dd > 7.4)
    tt = np.clip((yy + 0.5 - (cy - 9)) / 18, 0, 1)
    col = (np.array([238, 238, 242]) * (1 - tt[..., None]) + np.array([128, 130, 136]) * tt[..., None]).astype(np.uint8)
    w[chrome, :3] = col[chrome]
    for dy, n in ((-3, 9), (0, 6), (3, 3)):
        y = int(cy + dy)
        for x in range(int(cx + 4) - n, int(cx + 4)):
            w[y, x, :3] = col[y, x]
    # vermelho puxado para a faixa do aro: cinza (fora do quadro, onde ficam as luzes de verdade)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = a[..., :3].astype(int)
    rho = np.hypot((xx + 0.5 - 229.9) / 94.8, (yy + 0.5 - 104.1) / 94.6)
    red = (rgb[..., 0] > rgb[..., 1] + 12) & (rho > 0.8) & (rho < 1.12)
    g = ((rgb[..., 1] + rgb[..., 2]) // 2).astype(np.uint8)
    a[red, 0] = g[red]
    a[red, 1] = g[red]
    a[red, 2] = np.minimum(255, g[red] + 2)
    # luzes-espia da arte (bateria e óleo à esquerda, freio à direita): fundo escuro
    a[55:62, 181:194, :3] = (16, 18, 20)
    a[55:62, 279:288, :3] = (16, 18, 20)
    # linha branca no alto do painel e no teto: vira vidro (transparente)
    for img, rows in ((a, slice(0, 24)), (t, slice(t.shape[0] - 12, t.shape[0]))):
        sub = img[rows]
        white = (sub[..., :3].min(axis=2) > 180) & (sub[..., 3] > 0)
        sub[white, 3] = 0
    Image.fromarray(w).save(wp)
    Image.fromarray(a).save(dp)
    Image.fromarray(t).save(tp)
    print('emblema, faixa e linha branca')


if __name__ == '__main__':
    main()
