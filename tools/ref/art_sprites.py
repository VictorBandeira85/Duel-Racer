"""Sprites a partir de artes do Victor sem grade de pixel fixa (NSX e F40 de 2026-11): fundo
transparente/branco/xadrez sai, recorta o carro, reduz por área para a largura do jogo e o alfa
vira binário. Opcional: o verde da pintura vira vermelho (traseira e frente do NSX vieram verdes).
Máscara de pintura: red_mask. Emblemas e letreiros reais saem depois (brand_badges.py e TEXT).

Uso: python3 tools/ref/art_sprites.py <art> <pasta com prep-*.png> <src/assets/cars>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from vectra_sprites import red_mask  # noqa: E402

# text: letreiros (cada linha vira a cor da coluna logo à esquerda); cut: fora da pintura
# (lanternas, bancos vistos pelo vidro); holes: o fundo claro preso dentro (vão da asa) sai
CFG = {
    'nsx': {'width': {'side': 300, 'rear': 200, 'front': 200}, 'green2red': ('rear', 'front'), 'holes': (),
            'text': {}, 'cut': {'rear': [(4, 36, 196, 63)]}, 'glassband': {'rear': [(38, 43)]}, 'neutral': {'rear': [(32, 38), (43, 52)]}},
    'diablo': {'width': {'side': 300, 'rear': 200, 'front': 200}, 'green2red': (), 'holes': (), 'paint': 'purple',
               'text': {'rear': [(55, 43, 88, 50), (132, 40, 146, 52)]}, 'cut': {}, 'fillholes': ('side',)},
    'f40': {'width': {'side': 300, 'rear': 200, 'front': 200}, 'green2red': (), 'holes': ('rear', 'front'),
            'text': {'rear': [(85, 33, 117, 40)], 'side': [(203, 47, 218, 55)]},
            'cut': {'rear': [(15, 40, 185, 61)], 'front': [(45, 4, 155, 34)]}, 'wide_mask': True},
}


def match_v(a, m, ref_v):
    """o brilho da pintura convertida segue a distribuição da lateral (mesmo vermelho nas 3 vistas)"""
    hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL)
    v = hsv[..., 2][m].astype(float)
    ranks = np.argsort(np.argsort(v)) / max(1, len(v) - 1)
    hsv[..., 2][m] = np.percentile(ref_v, ranks * 100).astype(np.uint8)
    a[..., :3] = np.where(m[..., None], cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB_FULL), a[..., :3])


def purple_mask(a, cut=()):
    """pintura roxa (Diablo): tons de roxo/magenta, inclusive reflexos claros e bordas escuras"""
    hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(int)
    h, s, v = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
    m = (h > 262) & (h < 338) & (((s > 70) & (v > 40)) | ((s > 30) & (v > 170))) & (a[..., 3] > 0)
    for x0, y0, x1, y1 in cut:
        m[y0:y1, x0:x1] = False
    m &= cv2.erode((a[..., 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 12
    return keep[lab]


def green_to_red(a):
    hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(int)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (h > 85) & (h < 140) & (s > 60) & (a[..., 3] > 0)  # verde-azulado da pintura
    # reflexos claros da pintura verde (pouca cor, puxados para o ciano: frestas do aerofólio,
    # vincos): viram reflexo rosado da pintura vermelha (o vidro, bem azul e saturado, fica)
    m |= (h > 95) & (h < 152) & (s > 12) & (s < 60) & (v > 90) & (a[..., 3] > 0)
    hsv[..., 0] = np.where(m, 0, h)
    hsv[..., 1] = np.where(m, np.clip(s * 1.15 + 30, 0, 255), s)
    hsv[..., 2] = np.where(m, np.clip(v * 1.45 + 25, 0, 255), v)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL)
    a[..., :3] = np.where(m[..., None], out, a[..., :3])
    return m


def main():
    art, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = CFG[art]
    ref_v = None
    for k, tw in cfg['width'].items():
        rgb = np.array(Image.open(os.path.join(src, f'prep-{k}.png')).convert('RGB'))
        white = (rgb.min(axis=2) > 245)
        n, lab = cv2.connectedComponents(white.astype(np.uint8), connectivity=4)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        al = ~np.isin(lab, list(border))
        # magenta puro = transparente na arte original (vãos da asa, entre aerofólio e teto)
        al &= ~((rgb[..., 0] > 250) & (rgb[..., 1] < 5) & (rgb[..., 2] > 250))
        if k in cfg['holes']:
            # xadrez/branco preso entre a asa e a carroceria: claro, sem cor, mancha grande
            lt = ((rgb.min(axis=2) > 200) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) < 14)).astype(np.uint8)
            n2, lab2, st2, _ = cv2.connectedComponentsWithStats(lt, 4)
            for i in range(1, n2):
                if st2[i, cv2.CC_STAT_AREA] > 1500:
                    al[lab2 == i] = False
        al = cv2.morphologyEx(al.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
        if k in cfg.get('fillholes', ()):
            # furinhos transparentes no meio da arte (no vidro): fecham com a cor em volta
            inv = (~al).astype(np.uint8)
            n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
            bd = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]])))
            hole = np.zeros(al.shape, bool)
            for i in range(1, n2):
                if i not in bd and st2[i, cv2.CC_STAT_AREA] < 4000:
                    hole |= lab2 == i
            if hole.any():
                rgb = cv2.inpaint(rgb, cv2.dilate(hole.astype(np.uint8), np.ones((3, 3), np.uint8)), 5, cv2.INPAINT_TELEA)
                al |= hole
        n, lab, st, _ = cv2.connectedComponentsWithStats(al.astype(np.uint8), 8)
        al = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        ys, xs = np.nonzero(al)
        rgb, al = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        th = round(rgb.shape[0] * tw / rgb.shape[1])
        pm = np.dstack([rgb * al[..., None], al * 255]).astype(np.float32)
        sm = cv2.resize(pm, (tw, th), interpolation=cv2.INTER_AREA)
        a8 = sm[..., 3]
        colr = np.clip(sm[..., :3] / np.maximum(a8[..., None] / 255, 1e-3), 0, 255)
        a = np.dstack([colr, np.where(a8 >= 128, 255, 0)]).astype(np.uint8)
        if k in cfg['green2red']:
            gm = green_to_red(a)
            if ref_v is not None:
                match_v(a, gm, ref_v)
        for y0, y1 in cfg.get('neutral', {}).get(k, []):
            # sombras e frestas em volta do aerofólio: o ciano escuro da pintura verde vira preto neutro
            hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(int)
            band = np.zeros(a.shape[:2], bool)
            W_ = a.shape[1]
            band[y0:y1, int(W_ * 0.11):int(W_ * 0.89)] = True  # sem os retrovisores
            band &= (hsv[..., 0] > 100) & (hsv[..., 0] < 170) & (hsv[..., 1] > 30)
            hsv[..., 1] = np.where(band, hsv[..., 1] // 6, hsv[..., 1])
            a[..., :3] = np.where(band[..., None], cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL), a[..., :3])
        for y0, y1 in cfg.get('glassband', {}).get(k, []):
            # vidro visto pela fresta do aerofólio: o mesmo azul do vidro de cima (era ciano/verde)
            hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(int)
            top = hsv[int(a.shape[0] * 0.06):int(a.shape[0] * 0.19)]
            gh, gs = int(np.median(top[..., 0])), int(np.median(top[..., 1]))
            band = np.zeros(a.shape[:2], bool)
            band[y0:y1] = True
            band &= (hsv[..., 0] > 120) & (hsv[..., 0] < 160) & (hsv[..., 1] > 40)
            hsv[..., 0] = np.where(band, gh, hsv[..., 0])
            hsv[..., 1] = np.where(band, np.maximum(hsv[..., 1], gs), hsv[..., 1])
            hsv[..., 2] = np.where(band, (hsv[..., 2] * 0.85).astype(int), hsv[..., 2])
            a[..., :3] = np.where(band[..., None], cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL), a[..., :3])
        for x0, y0, x1, y1 in cfg['text'].get(k, []):
            for y in range(y0, y1):
                a[y, x0:x1, :3] = a[y, x0 - 2, :3]
        m = red_mask(a, cut=cfg['cut'].get(k, [])) if cfg.get('paint') != 'purple' else purple_mask(a, cfg['cut'].get(k, []))
        if cfg.get('wide_mask'):
            # a pintura inteira: também os reflexos rosados e as bordas vermelho-escuras (antes
            # sobravam fios rosa na troca de cor), menos o que se vê pelos vidros (bancos de couro)
            hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(int)
            h_, s_, v_ = hsv[..., 0], hsv[..., 1], hsv[..., 2]
            red = ((h_ >= 238) | (h_ <= 12)) & (a[..., 3] > 0)
            extra = red & (((s_ > 25) & (v_ > 150)) | ((s_ > 90) & (v_ > 45)))
            blue = (h_ > 130) & (h_ < 175) & (s_ > 60) & (v_ > 60)
            win = np.zeros(m.shape, np.uint8)
            n_, lab_, st_, _ = cv2.connectedComponentsWithStats(blue.astype(np.uint8), 8)
            for i in range(1, n_):
                if st_[i, cv2.CC_STAT_AREA] >= 25:
                    pts = np.stack(np.nonzero(lab_ == i)[::-1], 1).astype(np.int32)
                    cv2.fillPoly(win, [cv2.convexHull(pts)], 1)
            win = cv2.dilate(win, np.ones((3, 3), np.uint8)).astype(bool)
            # só perto da pintura (não pega lanternas soltas): vizinho de pintura já marcada
            near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
            m = (m | (extra & near)) & ~win
            for x0, y0, x1, y1 in cfg['cut'].get(k, []):
                m[y0:y1, x0:x1] = False
        if k == 'side':
            ref_v = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL)[..., 2][m]
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'{art}-{k}.png'), optimize=True)
        mk = np.zeros_like(a)
        mk[..., :3] = np.where(m[..., None], 255, 0)
        mk[..., 3] = a[..., 3]
        Image.fromarray(mk, 'RGBA').save(os.path.join(out, f'{art}-{k}-mask.png'), optimize=True)
        print(art, k, a.shape[1], a.shape[0], int(m.sum()))


if __name__ == '__main__':
    main()
