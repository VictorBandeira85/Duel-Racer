"""Cabine do Toro V12 (Diablo): tira a placa roxa chapada que sobrava embaixo do retrovisor esquerdo,
acima da soleira (resto da lataria de fora da arte, separado da soleira por uma fresta: parecia um
pedaço de carroceria solto). Fica só a soleira (o friso magenta) e o braço do retrovisor; o resto é
janela. Rodar depois de diablo_cockpit.py. Também vale para a viatura (usa a mesma cabine).
Uso: python3 tools/ref/diablo_door_fix.py <src/assets/cockpit>
"""
import os
import sys

import numpy as np
from PIL import Image

TOP = 76  # linhas do topo (coordenadas empilhadas topo + painel)


def main():
    d = sys.argv[1]
    tp, dp = os.path.join(d, 'diablo-top.png'), os.path.join(d, 'diablo-dash.png')
    t, a = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    st = np.concatenate([t, a], axis=0)
    n = 0
    for x in range(0, 47):
        # alto da soleira nesta coluna: o primeiro pixel magenta vivo descendo (o friso)
        col = st[110:160, x].astype(int)
        vivid = np.nonzero((col[:, 3] > 0) & (col[:, 0] > 200) & (col[:, 2] > 200) & (col[:, 1] < 140))[0]
        y1 = 110 + (vivid[0] if len(vivid) else int(11 + (46 - x) * 0.5))
        sel = st[110:y1, x, 3] > 0
        n += int(sel.sum())
        st[110:y1, x][sel] = 0
    Image.fromarray(st[:TOP], 'RGBA').save(tp, optimize=True)
    Image.fromarray(st[TOP:], 'RGBA').save(dp, optimize=True)
    # máscara de pintura: o friso magenta da soleira na parte construída à esquerda também é lataria
    # (na viatura, que repinta a cabine, a ponta ficava magenta)
    mp = os.path.join(d, 'diablo-dash-mask.png')
    if os.path.exists(mp):
        im = Image.open(mp)
        m = np.array(im.convert('L'))
        reg = a2 = st[TOP:, :110].astype(int)
        viv = (reg[..., 3] > 0) & (reg[..., 0] > 150) & (reg[..., 2] > 150) & (reg[..., 1] < reg[..., 0] * 0.6)
        m[:, :110][viv] = 255
        Image.fromarray(m, 'L').convert(im.mode).save(mp, optimize=True)
    print('placa removida:', n, 'px')


if __name__ == '__main__':
    main()
