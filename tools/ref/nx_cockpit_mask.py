"""Kaze NX: máscaras de pintura da cabine (faltavam: o capô e o retrovisor ficavam sempre vermelhos, de
qualquer cor que o carro fosse pintado). Lataria vista de dentro = a faixa do capô sob o para-brisa e a
carcaça do retrovisor do motorista (à direita: mão inglesa). Pega os tons avermelhados só nessas duas
regiões (com os reflexos rosados/claros colados neles); a faixa vermelha da saída de ar, o rádio e as
luzes do quadro ficam de fora.
Uso: python3 tools/ref/nx_cockpit_mask.py   -> src/assets/cockpit/nsx-dash-mask.png e nsx-top-mask.png"""
import os
import numpy as np
from PIL import Image

COCK = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cockpit')
t = np.array(Image.open(os.path.join(COCK, 'nsx-top.png')).convert('RGBA')).astype(int)
d = np.array(Image.open(os.path.join(COCK, 'nsx-dash.png')).convert('RGBA')).astype(int)
st = np.concatenate([t, d], axis=0)
H, W = st.shape[:2]
r, g, b, a = st[..., 0], st[..., 1], st[..., 2], st[..., 3]
yy, xx = np.mgrid[0:H, 0:W]
region = ((yy < 90) & (xx < 345)) | ((xx > 380) & (yy < 112))   # capô | retrovisor
red = (a > 0) & region & (r - np.maximum(g, b) > 18)
# reflexos claros (quase brancos/rosados) encostados na lataria também recebem a cor
light = (a > 0) & region & (r > 170) & (r >= g) & (r >= b) & ~red
near = red.copy()
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):  # vizinhos de um pixel
    near |= np.roll(np.roll(red, dy, axis=0), dx, axis=1)
mask = red | (light & near)
m = (mask * 255).astype(np.uint8)
Image.fromarray(m[:t.shape[0]], 'L').save(os.path.join(COCK, 'nsx-top-mask.png'), optimize=True)
Image.fromarray(m[t.shape[0]:], 'L').save(os.path.join(COCK, 'nsx-dash-mask.png'), optimize=True)
print('lataria:', int(mask.sum()), 'pixels')
