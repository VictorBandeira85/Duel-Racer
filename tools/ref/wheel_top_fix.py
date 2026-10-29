"""Reconstroi o alto do aro do volante quando a arte cortou o topo (linha 0 no meio do aro).

Uso: wheel_top_fix.py <png> [linhas]
Mede o círculo do aro pelas bordas externas/internas das laterais, acrescenta as linhas que faltam
no topo e preenche cada pixel do aro cortado com a cor do mesmo raio no ponto intacto mais
próximo do arco (o aro é sombreado radialmente). Imprime quantas linhas acrescentou (wheelTop).
"""
import sys, math
import numpy as np
from PIL import Image

path = sys.argv[1]
a = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
H, W = a.shape[:2]
al = a[..., 3] > 128
# bordas externas (esquerda/direita) nas linhas do meio
pts = []
for y in range(H // 6, H // 2):
    xs = np.nonzero(al[y])[0]
    if len(xs) > 10:
        pts.append((xs[0], y)); pts.append((xs[-1], y))
P = np.array(pts, np.float64)
# círculo por mínimos quadrados: x²+y² + Dx + Ey + F = 0
A = np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
b = -(P[:, 0] ** 2 + P[:, 1] ** 2)
D, E, F = np.linalg.lstsq(A, b, rcond=None)[0]
cx, cy = -D / 2, -E / 2
ro = math.sqrt(cx * cx + cy * cy - F)
# espessura do aro: numa linha acima do centro (sem raios nem miolo), da borda externa à primeira
# transparência, convertida em raio
yc = int(round(cy - 0.6 * ro))
xs = np.nonzero(al[yc])[0]
k = xs[0]
while k < W and al[yc, k]:
    k += 1
ri = math.hypot(cx - k + 0.5, cy - yc - 0.5)
n = int(sys.argv[2]) if len(sys.argv) > 2 else max(0, int(math.ceil(ro - cy)) + 1)
print(f'centro=({cx:.1f},{cy:.1f}) raio externo={ro:.1f} interno={ri:.1f} linhas={n}')
out = np.zeros((H + n, W, 4), np.float32)
out[n:] = a
for y in range(0, n + 6):
    for x in range(W):
        oy = y - n  # coordenada na arte original
        dx, dy = x + 0.5 - cx, oy + 0.5 - cy
        d = math.hypot(dx, dy)
        if d < ri - 0.5 or d > ro + 0.5 or dy >= 0:
            continue
        if oy >= 0 and out[y, x, 3] > 128:
            continue
        # menor ângulo (a partir do topo) em que esse raio já está dentro da arte, com folga de 2 px
        lim = (cy - 2.5) / d
        if lim >= 1:
            continue
        th = math.acos(max(-1, lim))
        s = 1 if dx >= 0 else -1
        sx = cx + s * d * math.sin(th) - 0.5
        sy = cy - d * math.cos(th) - 0.5
        ix, iy = int(round(sx)), int(round(sy))
        if 0 <= ix < W and 0 <= iy < H and a[iy, ix, 3] > 0:
            out[y, x] = a[iy, ix]
            # borda externa suave como no resto do aro
            if d > ro - 0.5:
                out[y, x, 3] *= max(0, min(1, ro + 0.5 - d))
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path)
