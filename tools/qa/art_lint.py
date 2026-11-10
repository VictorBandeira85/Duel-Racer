"""Conferência automática da arte (rodar antes de publicar): aponta os defeitos que já apareceram.
- cabine (topo + painel empilhados): furos transparentes pequenos cercados de pixels opacos (a estrada
  aparece por eles: molduras de retrovisor, colunas) e colunas repetidas na borda (arte esticada)
- sprites: máscara de pintura pegando lanterna/luz (vermelho ou âmbar saturado) e reflexos fora dela
Uso: python3 tools/qa/art_lint.py [carro ...]   (sem nomes: todos)   -> lista de avisos com posição
     python3 tools/qa/art_lint.py --fill <cabine ...>  fecha os furos pequenos (até 8 px) da cabine
     python3 tools/qa/art_lint.py --mask <arte ...>  põe na máscara os reflexos claros da pintura
"""
import glob
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
COCK = os.path.join(ROOT, 'src/assets/cockpit')
CARS = os.path.join(ROOT, 'src/assets/cars')


def rgba(p):
    return np.array(Image.open(p).convert('RGBA'))


def cockpit(name):
    out = []
    tp, dp = os.path.join(COCK, f'{name}-top.png'), os.path.join(COCK, f'{name}-dash.png')
    if not (os.path.exists(tp) and os.path.exists(dp)):
        return out
    t, d = rgba(tp), rgba(dp)
    if t.shape[1] != d.shape[1]:
        return out
    st = np.concatenate([t, d], axis=0)
    tr = (st[..., 3] < 128).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(tr, connectivity=4)
    H, W = tr.shape
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a > 60 or x == 0 or y == 0 or x + w >= W or y + h >= H:
            continue  # grandes (vidros) ou ligados à borda
        out.append(f'{name}: furo transparente de {a} px em x={x}..{x + w}, y={y}..{y + h} (topo+painel)')
    # bordas esticadas: 6+ colunas iguais seguidas nos dois lados
    for side, cols in (('esquerda', range(0, 40)), ('direita', range(W - 1, W - 41, -1))):
        cols = list(cols)
        run = 0
        for a_, b_ in zip(cols, cols[1:]):
            same = np.array_equal(st[:, a_, :], st[:, b_, :]) and st[:, a_, 3].any()
            run = run + 1 if same else 0
            if run >= 6:
                out.append(f'{name}: borda {side} esticada (colunas repetidas perto de x={b_})')
                break
    return out


def sprite(art):
    out = []
    for v in ('side', 'rear', 'front'):
        p, mp = os.path.join(CARS, f'{art}-{v}.png'), os.path.join(CARS, f'{art}-{v}-mask.png')
        if not (os.path.exists(p) and os.path.exists(mp)):
            continue
        a = rgba(p)
        m = np.array(Image.open(mp).convert('L')) > 127
        hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
        h, s, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
        body_hue = np.median(h[m]) if m.any() else 0
        amber = m & (h > 25) & (h < 50) & (s > 170) & (val > 170)
        if amber.sum() > 6 and not (20 < body_hue < 65):  # carro amarelo/laranja: âmbar é a pintura
            ys, xs = np.nonzero(amber)
            out.append(f'{art}-{v}: máscara pinta {amber.sum()} px âmbar (pisca/farol?) perto de x={int(xs.mean())}, y={int(ys.mean())}')
        # reflexos claros encostados na máscara e fora dela (ficam rosa/claro na troca de cor)
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        body_h = np.median(h[m]) if m.any() else 0
        refl = near & ~m & (a[..., 3] > 0) & (val > 150) & (s > 15) & (s < 110) & (np.abs(((h - body_h + 180) % 360) - 180) < 25)
        if refl.sum() > 25:
            out.append(f'{art}-{v}: {refl.sum()} px de reflexo da pintura fora da máscara')
    return out


def fill_tiny(name, maxa=8):
    """fecha os furos de até maxa px (cor do vizinho opaco mais comum)"""
    tp, dp = os.path.join(COCK, f'{name}-top.png'), os.path.join(COCK, f'{name}-dash.png')
    t, d = rgba(tp), rgba(dp)
    st = np.concatenate([t, d], axis=0)
    tr = (st[..., 3] < 128).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(tr, connectivity=4)
    H, W = tr.shape
    k = 0
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a > maxa or x == 0 or y == 0 or x + w >= W or y + h >= H:
            continue
        ys, xs = np.nonzero(lab == i)
        for yy, xx in zip(ys, xs):
            nb = [st[yy + dy, xx + dx] for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)) if st[yy + dy, xx + dx, 3] >= 128]
            if nb:
                st[yy, xx] = np.median(np.array(nb), axis=0).astype(np.uint8)
                st[yy, xx, 3] = 255
                k += 1
    Image.fromarray(st[:t.shape[0]], 'RGBA').save(tp, optimize=True)
    Image.fromarray(st[t.shape[0]:], 'RGBA').save(dp, optimize=True)
    return k


def fix_mask(art, rounds=3):
    """reflexos claros da pintura encostados na máscara (mesmo matiz, pouca cor) entram nela"""
    k = 0
    for v in ('side', 'rear', 'front'):
        p, mp = os.path.join(CARS, f'{art}-{v}.png'), os.path.join(CARS, f'{art}-{v}-mask.png')
        if not (os.path.exists(p) and os.path.exists(mp)):
            continue
        a = rgba(p)
        m = np.array(Image.open(mp).convert('L')) > 127
        hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
        h, s, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
        body_h = np.median(h[m])
        cand = (a[..., 3] > 0) & (val > 140) & (s > 12) & (s < 120) & (np.abs(((h - body_h + 180) % 360) - 180) < 28)
        n0 = m.sum()
        for _ in range(rounds):
            near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            m = m | (near & cand)
        k += int(m.sum() - n0)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(mp, optimize=True)
    return k


def main():
    if sys.argv[1:2] == ['--mask']:
        for nme in sys.argv[2:]:
            print(nme, 'pixels de reflexo incluídos:', fix_mask(nme))
        return

    if sys.argv[1:2] == ['--fill']:
        for nme in sys.argv[2:]:
            print(nme, 'furos fechados:', fill_tiny(nme))
        return
    names = sys.argv[1:]
    cks = names or sorted({os.path.basename(p)[:-9] for p in glob.glob(os.path.join(COCK, '*-dash.png'))})
    arts = names or sorted({os.path.basename(p)[:-9] for p in glob.glob(os.path.join(CARS, '*-side.png'))})
    warn = []
    for c in cks:
        warn += cockpit(c)
    for a in arts:
        warn += sprite(a)
    print('\n'.join(warn) if warn else 'nenhum aviso')
    print(f'-- {len(warn)} aviso(s)')


if __name__ == '__main__':
    main()
