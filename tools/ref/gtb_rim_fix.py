"""Onça GTB: refaz a faixa do aro original no painel (br-pumagtb-dash.png).

A importação apagou o aro da arte e pintou a faixa coluna a coluna: sobrou um aro cinza borrado
um pouco mais largo que o volante do jogo (parecia volante duplicado, com borrão em volta).
Cada pixel da faixa vira a cor do painel limpo logo além dela no mesmo raio (por fora, na
margem de fora; por dentro, na margem de dentro) e o meio da faixa, que o aro do jogo sempre
cobre, a passagem entre os dois. Elipse do aro medida em tools/ref/wheels/br-pumagtb.json.
Uso: gtb_rim_fix.py <dash.png> [cx cy rx ry interna/externa margem] (rodar uma vez sobre a
arte importada; sem os números, as medidas da Onça GTB)
"""
import sys
import numpy as np
from PIL import Image

P = sys.argv[1]
a = np.array(Image.open(P).convert('RGBA')).astype(np.float32)
H, W = a.shape[:2]
cx, cy = 228.96, 128.3  # centro do aro (coordenadas do painel)
rx, ry = 107.6, 127.3   # elipse externa
RI = 0.898              # interna / externa
MO = MI = 0.085         # margem apagada (rim_margin 7 + borrão)
ANG = 6  # meia abertura (graus) da média de cada amostra
SKY = False  # 'ceu': onde além do aro só há para-brisa, a margem de fora e o meio da faixa ficam transparentes
if len(sys.argv) > 2:
    cx, cy, rx, ry, RI, MO = map(float, sys.argv[2:8])
    MI = MO
    SKY = len(sys.argv) > 8 and sys.argv[8] == 'ceu'
    if len(sys.argv) > 9:
        ANG = float(sys.argv[9])
lo_r, hi_r = RI - MI - 0.02, 1 + MO + 0.02
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
ex, ey = (xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry
rho = np.hypot(ex, ey)
band = (rho >= RI - MI) & (rho <= 1 + MO) & (a[..., 3] > 0)
ux, uy = ex / np.maximum(rho, 1e-6), ey / np.maximum(rho, 1e-6)


def sample1(rr, dth):
    c, s_ = np.cos(dth), np.sin(dth)
    vx, vy = ux * c - uy * s_, ux * s_ + uy * c
    sxf, syf = np.round(cx + vx * rr * rx - 0.5), np.round(cy + vy * rr * ry - 0.5)
    sx = np.clip(sxf.astype(int), 0, W - 1)
    sy = np.clip(syf.astype(int), 0, H - 1)
    v = a[sy, sx].copy()
    if SKY:  # acima do painel (fora da imagem) é para-brisa
        v[syf < 0, 3] = 0
    return v


def sample(rr, sgn):
    # média de uma faixa de painel limpo junto da borda (alguns raios e ±6°): cor lisa, sem riscos
    acc = np.zeros_like(a)
    n = np.zeros(a.shape[:2] + (1,), np.float32)
    for k in range(3):
        for d in np.radians(np.arange(-ANG, ANG + 0.1, 1.5)):
            v = sample1(rr + sgn * 0.02 * k, d)
            w = (v[..., 3:4] > 0).astype(np.float32)
            acc += v * w
            n += w
    out = acc / np.maximum(n, 1)
    out[..., 3:4] = np.where(n > 0, 255, 0)
    return out


out_c, in_c = sample(hi_r, 1), sample(lo_r, -1)
# no alto, além do aro só há para-brisa (transparente): ali a faixa toda vem de dentro (ou,
# com 'ceu', o que não é a margem de dentro fica transparente: céu atrás do aro)
sky_out = out_c[..., 3] == 0
out_c = np.where((~sky_out)[..., None], out_c, in_c)
t = np.clip((rho - (RI - 0.005)) / (1.005 - (RI - 0.005)), 0, 1)[..., None]
mid = in_c * (1 - t) + out_c * t
res = np.where((rho > 1)[..., None], out_c, np.where((rho < RI)[..., None], in_c, mid))
# fora do painel (transparente) por fora: continua transparente
res[..., 3] = np.where(res[..., 3] > 0, 255, 0)
if SKY:
    res[..., 3] = np.where(sky_out & (rho >= RI), 0, res[..., 3])
a[band] = res[band]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(P)
print('faixa refeita:', int(band.sum()))
