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
    # o aro original da arte foi apagado e reconstruído borrado; com o volante mais baixo no
    # jogo (wheelDy 20), a parte de cima dessa faixa aparece em volta do quadro como um borrão
    # cinza. Refaz a faixa linha a linha: cada pixel vira a passagem suave entre o painel limpo
    # à esquerda e à direita na mesma linha (o painel tem estrutura horizontal), sem borrão.
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = 229.9, 99.9
    ro = ((xx - cx) / 114.5) ** 2 + ((yy - cy) / 127.5) ** 2
    ri = ((xx - cx) / 95.0) ** 2 + ((yy - cy) / 106.0) ** 2
    ghost = (ro <= 1) & (ri >= 1) & (a[..., 3] > 0)
    lcd = (xx >= 159) & (xx <= 315) & (yy >= 20) & (yy <= 79)
    ghost &= ~lcd
    ghost[:, :119] = False  # saída de ar da esquerda
    ghost[:, 341:] = False  # e as da direita
    ghost[:, 112:142] |= (yy[:, 112:142] >= 22) & (yy[:, 112:142] <= 66) & (a[:, 112:142, 3] > 0) & ~lcd[:, 112:142]
    known = (a[..., 3] > 0) & ~ghost
    rgb = a[..., :3].astype(float)
    for y in range(H):
        xs = np.nonzero(ghost[y])[0]
        if not len(xs):
            continue
        k = np.nonzero(known[y])[0]
        if not len(k):
            continue
        for x in xs:
            l = k[k < x]
            r_ = k[k > x]
            if len(l) and len(r_):
                xl, xr = l[-1], r_[0]
                f = (x - xl) / (xr - xl)
                rgb[y, x] = rgb[y, xl] * (1 - f) + rgb[y, xr] * f
            else:
                rgb[y, x] = rgb[y, (l[-1] if len(l) else r_[0])]
    # suaviza na vertical só a faixa refeita (sem riscos linha a linha)
    sm = cv2.blur(rgb.astype(np.float32), (3, 9))
    a[ghost, :3] = np.clip(sm[ghost], 0, 255).astype(np.uint8)
    print('GTI faixa do aro antigo refeita:', int(ghost.sum()))
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
