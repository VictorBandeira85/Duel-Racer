"""Monta os sprites da Diablo SV (amarela, a pintura troca pela máscara) e da Diablo da polícia
a partir da pixel art importada (import_art.py): limpa a franja clara da borda e, na viatura,
pinta a carroceria de preto com as portas brancas, põe o giroflex no teto, o brasão na porta e
"POLICE" na lateral e no para-choque.

Uso: python3 tools/ref/diablo_sprites.py <pasta com side.png rear.png front.png> <src/assets>
(side/rear/front.png: a arte reamostrada na grade nativa, tools/ref/regrid.py, períodos 4.56,
4.49 e 5.13; as posições da viatura abaixo foram medidas na lateral 300x82 e na frente/traseira
200x112 e são escaladas para o tamanho real)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

GLYPH = {
    'P': ['111', '101', '111', '100', '100'], 'O': ['111', '101', '101', '101', '111'],
    'L': ['100', '100', '100', '100', '111'], 'I': ['111', '010', '010', '010', '111'],
    'C': ['111', '100', '100', '100', '111'], 'E': ['111', '100', '111', '100', '111'],
}


def clean(a):
    """Polimento: tira a franja clara (bege, misturada com o fundo branco) e os pixels soltos da
    borda, fecha a silhueta com contorno escuro de 1 pixel e reduz a paleta (sem cores
    intermediárias borradas entre uma faixa e outra)."""
    k8 = np.ones((3, 3), np.uint8)
    for _ in range(3):
        al = a[..., 3] > 0
        border = al & (cv2.dilate((~al).astype(np.uint8), k8) > 0)
        hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV).astype(int)
        # claros e pouco saturados na borda = mistura com o fundo branco
        washed = (hsv[..., 2] > 150) & (hsv[..., 1] < 140)
        # pixel solto: menos de 3 vizinhos opacos
        nb = cv2.filter2D(al.astype(np.uint8), -1, k8, borderType=cv2.BORDER_CONSTANT) - al
        a[(border & washed) | (al & (nb < 3)), 3] = 0
    al = a[..., 3] > 0
    # paleta curta (em Lab), como pixel art desenhada à mão
    lab = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2LAB).astype(np.float32)
    pts = lab[al]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.3)
    _, lbl, cen = cv2.kmeans(pts, 22, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    L = np.full(al.shape, -1, np.int32)
    L[al] = lbl.ravel()
    # pixel isolado (cor que nenhum vizinho tem): vira a cor mais comum em volta (tira o chuvisco)
    H, W = L.shape
    for _ in range(2):
        out = L.copy()
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                v = L[y, x]
                if v < 0:
                    continue
                nb = [L[y - 1, x], L[y + 1, x], L[y, x - 1], L[y, x + 1]]
                if v not in nb:
                    n8 = [t for t in L[y - 1:y + 2, x - 1:x + 2].ravel() if t >= 0 and t != v]
                    if n8:
                        out[y, x] = max(set(n8), key=n8.count)
        L = out
    q = lab.copy()
    q[al] = cen[L[al]]
    a[..., :3] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    # contorno: a borda da silhueta fica escura (o que já é escuro continua como está)
    border = al & (cv2.erode(al.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) == 0)
    rgb = a[..., :3].astype(np.float32)
    dark = rgb.max(axis=2) < 70
    sel = border & ~dark
    rgb[sel] = rgb[sel] * 0.25 + np.array([24, 20, 14]) * 0.75
    a[..., :3] = rgb.astype(np.uint8)
    return a


def body(a):
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV)
    return (a[..., 3] > 0) & (hsv[..., 0] >= 17) & (hsv[..., 0] <= 34) & (hsv[..., 1] > 70) & (hsv[..., 2] > 45)


def repaint(a, m, lo, hi):
    """Pinta a área m num cinza entre lo e hi, conforme o brilho original (mantém o sombreado)."""
    v = a[..., :3].astype(np.float32).max(axis=2)
    t = np.clip((v - 60) / 195, 0, 1)
    g = (lo + (hi - lo) * t).astype(np.uint8)
    for k in range(3):
        a[..., k][m] = g[m]


def text(a, s, x, y, color):
    for i, ch in enumerate(s):
        for r, row in enumerate(GLYPH[ch]):
            for c, bit in enumerate(row):
                if bit == '1':
                    a[y + r, x + i * 4 + c] = color


def pad_top(a, n):
    return np.concatenate([np.zeros((n, a.shape[1], 4), np.uint8), a], axis=0)


def lightbar(a, x0, x1, y, left, right):
    """Giroflex: moldura preta, metade de cada cor, centro branco."""
    col = {'red': (230, 30, 30, 255), 'blue': (40, 90, 240, 255)}
    a[y:y + 5, x0:x1] = (14, 14, 18, 255)
    mid = (x0 + x1) // 2
    a[y + 1:y + 4, x0 + 1:mid - 2] = col[left]
    a[y + 1:y + 4, mid + 2:x1 - 1] = col[right]
    a[y + 1:y + 4, mid - 2:mid + 2] = (235, 235, 235, 255)
    a[y + 1, x0 + 2:mid - 3] = np.minimum(np.array(col[left]) + 70, 255)
    a[y + 1, mid + 3:x1 - 2] = np.minimum(np.array(col[right]) + 70, 255)


def main():
    src, assets = sys.argv[1], sys.argv[2]
    cars = os.path.join(assets, 'cars')
    imgs = {v: clean(np.array(Image.open(os.path.join(src, f'{v}.png')).convert('RGBA'))) for v in ('side', 'rear', 'front')}
    for v, a in imgs.items():
        Image.fromarray(a, 'RGBA').save(os.path.join(cars, f'diablo-{v}.png'))
        m = body(a)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(cars, f'diablo-{v}-mask.png'))
        print(v, a.shape[1], a.shape[0], 'máscara', int(m.sum()))

    # ---- viatura: preta, portas brancas ----
    s = imgs['side'].copy()
    H, W = s.shape[:2]
    X = lambda v: int(round(v * W / 300))  # noqa: E731
    Y = lambda v: int(round(v * H / 82))  # noqa: E731
    m = body(s)
    door = np.zeros(m.shape, np.uint8)
    cv2.fillPoly(door, [np.array([(X(x), Y(y)) for x, y in [(78, 30), (125, 24), (170, 21), (171, 52), (92, 56), (85, 45)]], np.int32)], 1)
    repaint(s, m & (door == 0), 12, 62)
    repaint(s, m & (door > 0), 175, 248)
    # brasão (estrela dourada num escudo azul) e POLICE no paralama traseiro
    bx, by = X(128), Y(33)
    s[by:by + 7, bx:bx + 7] = (30, 60, 150, 255)
    for (yy, xx) in [(1, 3), (2, 2), (2, 3), (2, 4), (3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (4, 2), (4, 4), (5, 1), (5, 5)]:
        s[by + yy, bx + xx] = (240, 200, 40, 255)
    text(s, 'POLICE', X(208), Y(30), (240, 240, 240, 255))
    s = pad_top(s, 5)
    lightbar(s, X(148), X(176), 1, 'red', 'blue')
    Image.fromarray(s, 'RGBA').save(os.path.join(cars, 'patrolsv-side.png'))

    f = imgs['front'].copy()
    fx = lambda v: int(round(v * f.shape[1] / 200))  # noqa: E731
    repaint(f, body(f), 12, 62)
    text(f, 'POLICE', fx(100) - 12, int(round(84 * f.shape[0] / 112)), (240, 240, 240, 255))
    lightbar(f, fx(64), fx(136), int(round(4 * f.shape[0] / 112)), 'red', 'blue')
    Image.fromarray(f, 'RGBA').save(os.path.join(cars, 'patrolsv-front.png'))

    r = imgs['rear'].copy()
    repaint(r, body(r), 12, 62)
    r = pad_top(r, 5)
    lightbar(r, int(round(64 * r.shape[1] / 200)), int(round(136 * r.shape[1] / 200)), 0, 'blue', 'red')
    Image.fromarray(r, 'RGBA').save(os.path.join(cars, 'patrolsv-rear.png'))
    for v, a in (('front', f), ('rear', r)):
        Image.fromarray(a, 'RGBA').save(os.path.join(assets, 'traffic', f'policesv-{v}.png'))
    print('viatura', s.shape[1::-1], f.shape[1::-1], r.shape[1::-1])


if __name__ == '__main__':
    main()
