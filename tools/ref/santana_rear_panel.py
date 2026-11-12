"""Savana GLS, traseira: o painel abaixo das lanternas (faixa frisada com o emblema e o "GLS", e a
faixa lisa logo abaixo, até o para-choque) é CARROCERIA, não para-choque: na arte veio em chumbo
escuro e o santana_sprites.py tinha deixado com a cor do para-choque. Aqui ele passa para os tons da
lataria (mantendo os frisos como variação de brilho) e entra na máscara de pintura. Emblema da Ipê,
letras "GLS" e os contornos pretos ficam como estão.
Rodar depois do santana_sprites.py (só mexe em pixels ainda acinzentados: rodar de novo não estraga).
Uso: python3 tools/ref/santana_rear_panel.py"""
import os
import numpy as np
from PIL import Image

CARS = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cars')
Y0, Y1 = 102, 118          # linhas do painel no sprite de 260 px (medidas)
sp = os.path.join(CARS, 'br-santana-rear.png')
mp = os.path.join(CARS, 'br-santana-rear-mask.png')
a = np.array(Image.open(sp).convert('RGBA')).astype(float)
m0 = Image.open(mp)
m = np.array(m0.convert('L')) > 127
H, W = m.shape
rgb = a[..., :3]
lum = rgb.max(2) / 255
sat = (rgb.max(2) - rgb.min(2)) / np.maximum(rgb.max(2), 1)
yy, xx = np.mgrid[0:H, 0:W]
# tons da lataria: os pixels já pintáveis da traseira, do mais escuro ao mais claro
body = rgb[m]
order = np.argsort(body.max(1))
ramp = body[order]
# o painel: entre os contornos pretos de cada lado (a carroceria se fecha no preto da borda)
inside = np.zeros((H, W), bool)
for y in range(Y0, Y1 + 1):
    xs = np.nonzero((a[y, :, 3] > 0) & (lum[y] > 0.12))[0]
    if len(xs):
        inside[y, xs.min() + 1:xs.max()] = True
logo = (sat > 0.35) & (lum > 0.25)                    # emblema da Ipê
letters = (lum > 0.55) & (xx >= 230) & (xx <= 246) & (yy >= 106) & (yy <= 109)  # "GLS" (caixa medida)
grow = logo | letters
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    grow |= np.roll(np.roll(logo, dy, 0), dx, 1)
band = inside & ~grow & ~m
# cada LINHA ganha um tom só da lataria, pela mediana do brilho dela na arte: os frisos continuam
# como linhas mais escuras e mais claras, sem o chuvisco de pixel a pixel
rows = {y: np.median(lum[y][band[y]]) for y in range(Y0, Y1 + 1) if band[y].any()}
v = np.array(list(rows.values()))
lo, hi = v.min(), v.max()
for y, l in rows.items():
    t = (l - lo) / max(hi - lo, 1e-3)
    tone = ramp[int((0.18 + 0.62 * t) * (len(ramp) - 1))]
    rgb[y][band[y]] = tone
# letras cromadas sobre a cor da carroceria: um pixel de sombra embaixo de cada traço para lerem
sh = np.roll(letters, 1, 0) & ~letters & band
rgb[sh] = ramp[int(0.08 * (len(ramp) - 1))]
a[..., :3] = rgb
Image.fromarray(a.astype(np.uint8), 'RGBA').save(sp, optimize=True)
Image.fromarray(((m | band) * 255).astype(np.uint8), 'L').convert(m0.mode).save(mp, optimize=True)
print('painel traseiro: pixels', int(band.sum()))
