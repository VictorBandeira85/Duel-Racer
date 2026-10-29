"""Revisão das cabines importadas: tira manchas e restos que sobraram da importação.
- Gaúcho GTI: mancha vermelha borrada à esquerda do volante (sobra de uma luz-espia da arte)
- Onça GTB: limpador de para-brisa levantado acima do painel (como no GTE) e um ponto vermelho
- Onça GTE: dois pontinhos pretos soltos no céu (restos do limpador)
- Cadete GSi: bordinha azul-clara no vidro do retrovisor (xadrez da arte)
- Vortex ZR: risco preto solto no céu, à direita do topo da coluna (borda do teto da arte)

Uso: python3 tools/ref/cockpit_cleanup.py src/assets/cockpit
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image


def load(d, k):
    t = np.array(Image.open(os.path.join(d, f'{k}-top.png')).convert('RGBA'))
    a = np.array(Image.open(os.path.join(d, f'{k}-dash.png')).convert('RGBA'))
    return t, a


def save(d, k, t, a):
    Image.fromarray(t, 'RGBA').save(os.path.join(d, f'{k}-top.png'))
    Image.fromarray(a, 'RGBA').save(os.path.join(d, f'{k}-dash.png'))


def inpaint(img, mask):
    mask = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    mask &= img[..., 3] > 0
    bgr = cv2.cvtColor(np.ascontiguousarray(img[..., :3]), cv2.COLOR_RGB2BGR)
    fill = cv2.inpaint(bgr, mask.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    img[mask, :3] = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB)[mask]
    return int(mask.sum())


def reds(img):
    rgb = img[..., :3].astype(int)
    return (rgb[..., 0] > rgb[..., 1] + 45) & (rgb[..., 0] > rgb[..., 2] + 45) & (img[..., 3] > 0)


def main():
    d = sys.argv[1]
    # Gaúcho GTI: mancha vermelha à esquerda do volante
    t, a = load(d, 'br-golgti')
    zone = np.zeros(a.shape[:2], bool)
    zone[28:54, 112:138] = True
    rgb = a[..., :3].astype(int)
    warm = (rgb[..., 0] > rgb[..., 2] + 12) & (rgb.mean(axis=2) > 45)  # o brilho rosado em volta
    print('GTI mancha:', inpaint(a, (reds(a) | warm) & zone))
    # o borrão que a reconstrução deixou no lugar: painel liso, no tom do painel em volta,
    # escurecendo de leve para baixo (como o resto do plástico)
    ref = a[24:64, 142:150, :3].reshape(-1, 3).astype(int)
    base = np.median(ref[ref.mean(axis=1) < 60], axis=0) if (ref.mean(axis=1) < 60).any() else np.array([26, 26, 30])
    for y in range(26, 64):
        k = 1.06 - 0.12 * (y - 26) / 38
        a[y, 120:141, :3] = np.clip(base * k, 0, 255).astype(np.uint8)
    a[26:64, 120, :3] = (12, 12, 14)  # vinco entre a saída de ar e o painel
    save(d, 'br-golgti', t, a)
    # Onça GTB: limpador levantado (separado do painel por céu) e ponto vermelho
    t, a = load(d, 'br-pumagtb')
    c = np.vstack([t, a])
    n0 = int((c[..., 3] > 0).sum())
    for x in range(290, c.shape[1]):
        col = c[:, x, 3]
        y = 82
        while y > 40 and col[y] > 0:
            y -= 1
        c[40:y, x, 3] = 0  # tudo o que está acima do primeiro vão de céu
    t, a = c[:t.shape[0]], c[t.shape[0]:]
    zone = np.zeros(a.shape[:2], bool)
    zone[0:8, 370:420] = True
    rgb = a[..., :3].astype(int)
    warm = (rgb[..., 0] > rgb[..., 2] + 20) & (rgb.mean(axis=2) > 50)
    print('GTB limpador:', n0 - int((c[..., 3] > 0).sum()), 'ponto:', inpaint(a, (reds(a) | warm) & zone))
    a[0:3, 390:400, 3] = 0  # o calombinho avermelhado (base do limpador) acima da borda do painel
    save(d, 'br-pumagtb', np.ascontiguousarray(t), np.ascontiguousarray(a))
    # Onça GTE: pontinhos soltos no céu
    t, a = load(d, 'br-pumagte')
    op = (t[..., 3] > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(op, 8)
    k = 0
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] <= 6:
            t[lab == i, 3] = 0
            k += st[i, cv2.CC_STAT_AREA]
    print('GTE pontos:', k)
    save(d, 'br-pumagte', t, a)
    # Cadete GSi: borda azul do vidro do retrovisor vira vidro
    t, a = load(d, 'br-kadett')
    c = np.vstack([t, a])
    rgb = c[..., :3].astype(int)
    zone = np.zeros(c.shape[:2], bool)
    zone[70:140, 0:75] = True
    blue = zone & (c[..., 3] > 0) & (rgb[..., 2] > rgb[..., 0] + 25) & (rgb.mean(axis=2) > 120)
    c[blue, :3] = (200, 210, 222)
    print('Cadete retrovisor:', int(blue.sum()))
    save(d, 'br-kadett', np.ascontiguousarray(c[:t.shape[0]]), np.ascontiguousarray(c[t.shape[0]:]))
    # Vortex ZR: risco preto à direita do topo da coluna
    t, a = load(d, 'zr1')
    k = int((t[10:15, 107:, 3] > 0).sum())
    t[10:15, 107:, 3] = 0
    print('Vortex risco:', k)
    save(d, 'zr1', t, a)


if __name__ == '__main__':
    main()
