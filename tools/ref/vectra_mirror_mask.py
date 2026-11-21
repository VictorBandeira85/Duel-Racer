"""Vetor GSi: máscaras de pintura da cabine (br-vectra-top-mask / -dash-mask): a carcaça do retrovisor
esquerdo é da cor da carroceria (no carro real também). Entra todo pixel opaco da carcaça, contorno
escuro incluído (a pintura escurece na proporção do tom), até a coluna (x 97) e acima da borda da porta.
Coordenadas no topo+painel empilhados (topo = 76 linhas), com as 102 colunas de folga.
Rodar depois do vectra_magenta_fringe.py."""
import cv2
import numpy as np
from PIL import Image

C = 'src/assets/cockpit/br-vectra-'
t, d = (np.array(Image.open(C + n + '.png').convert('RGBA')) for n in ('top', 'dash'))
st = np.concatenate([t, d])
H, W = st.shape[:2]
yy, xx = np.mgrid[:H, :W]
door = 160 - (xx - 55) / 3          # borda de cima da porta (medida na arte)
m = (st[..., 3] > 0) & (xx >= 17) & (xx < 97) & (yy >= 87) & (yy < np.minimum(door - 1, 147))
# só o que é ligado à carcaça (a borda da porta, logo abaixo, fica de fora)
n, lab = cv2.connectedComponents(m.astype(np.uint8), connectivity=4)
m = lab == lab[93, 40] if lab[93, 40] else m
out = np.zeros((H, W, 4), np.uint8)
out[m] = (255, 255, 255, 255)
out[~m, 3] = 255
Image.fromarray(out[:t.shape[0]], 'RGBA').save(C + 'top-mask.png', optimize=True)
Image.fromarray(out[t.shape[0]:], 'RGBA').save(C + 'dash-mask.png', optimize=True)
print('retrovisor:', int(m.sum()), 'pixels')
