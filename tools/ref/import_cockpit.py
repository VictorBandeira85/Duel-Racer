"""Converte a arte de um interior (vista do motorista) na cabine do jogo.

Gera dois PNGs do mesmo tamanho (256 x linhas, pixels nativos com pixel 8:7):
  <carro>-dash.png  painel sem o volante e sem os ponteiros (reconstruídos por inpainting);
                    o branco do para-brisa (ligado à borda de cima) fica transparente
  <carro>-wheel.png só o volante, para girar em torno do centro do aro
e imprime as posições (em pixels nativos) do pivô do volante e dos mostradores.

Uso: python3 tools/ref/import_cockpit.py <imagem> <pasta> <carro>   (configurações abaixo)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROWS = 124  # linhas nativas (a cabine começa na linha 100 da tela e vai até a 224)
EXT = 76    # linhas entre o teto (24) e o topo da arte (100)
PAD = 102   # colunas extras de cada lado do painel, para telas largas (até 460 px)

CARS = {
    'f40': {
        'scale': 0.25, 'x0': 338, 'y0': 50,
        'gauges': {'tach': (774, 200, 70), 'speed': (934, 200, 70)},
        'pillar': (40, 0.40),   # coluna da porta: até x nativo 40, sobe 0,40 px para a esquerda por linha
    },
    # 959: interior completo desenhado pelo Victor, com colunas do para-brisa e portas
    '959': {
        'scale': 0.36, 'x0': 299, 'y0': 155,   # volante inteiro no centro; em tela larga aparecem coluna, porta e retrovisor
        'gauges': {'tach': (660, 275, 67), 'speed': (790, 285, 55), 'aux1': (405, 285, 46),
                   'aux2': (530, 285, 50), 'clock': (920, 285, 52)},
        'top_art': [], 'sky_left': True,
        'hub_fill': ((22, 22, 25), 340),
        'wheel_rows': 172, 'paint': 'column', 'rim_margin': 7, 'hole_sky_above': 150,
        # borda de cima do painel entre as colunas (acima: limpadores, que viram vidro)
        'dash_curve': [(199, -1000), (205, 160), (300, 158), (400, 155), (500, 151), (600, 147),
                       (700, 148), (800, 149), (900, 151), (1000, 154), (1100, 156), (1200, 157),
                       (1300, 158), (1400, 160), (1485, 162), (1491, -1000)],
    },
    # viatura: interior completo desenhado pelo Victor (porta, painel, console e passageiro)
    'patrol': {
        'scale': 0.48, 'x0': 218, 'y0': 212,   # volante centralizado, inteiro, com o miolo à vista
        'gauges': {'tach': (400, 332, 57), 'speed': (591, 332, 57)},
        # hodômetro e indicador de marcha: fundo liso, o jogo desenha os números funcionando
        'lcd': [((28, 29, 31), (464, 291, 530, 311)), ((28, 29, 31), (464, 320, 530, 334))],
        'top_art': [(690, 0, 990, 140)],   # sem o retrovisor interno (o jogo tem o seu)
        'hub_fill': ((27, 28, 31), 370),   # atrás do miolo: cor lisa, a coluna de direção é desenhada depois
        'wheel_rows': 220, 'paint': 'column', 'rim_margin': 9,
        'sky_left': True, 'hole_sky_above': 228,
    },
    # Corvette C4: painel digital (os visores de LCD são redesenhados funcionando no jogo)
    'zr1': {
        'scale': 0.35, 'x0': 153, 'y0': 175,
        'gauges': {},
        'lcd': [((38, 40, 38), (350, 252, 472, 364)), ((38, 40, 38), (698, 262, 792, 364)),
                ((38, 40, 38), (480, 244, 658, 362))],
        'top_art': [(690, 0, 990, 100), (0, -40, 1680, 14)],  # colunas da arte; sem retrovisor interno nem a borda do teto
    },
}


def sample(img, w, h):
    """Arte em pixel art: amostra o centro de cada bloco (sem misturar cores)."""
    xs = ((np.arange(w) + 0.5) * img.shape[1] / w).astype(int)
    ys = ((np.arange(h) + 0.5) * img.shape[0] / h).astype(int)
    return img[ys][:, xs]


def above_curve(pts, ox, oy, h, w):
    """Máscara do que fica acima de uma linha (pontos x, y da arte), no recorte que começa em (ox, oy)."""
    xs, ys = zip(*pts)
    yc = np.interp(np.arange(w) + ox, xs, ys) - oy
    return np.arange(h)[:, None] < yc[None, :]


def hexrgb(c):
    return [int(c[i:i + 2], 16) for i in (1, 3, 5)]


def paint_patrol(rgb, a, art_l, art_r, pivot, hub):
    """Viatura: a arte cobre só o meio do painel. Desenha em pixel nativo a porta do
    motorista (vidro, retrovisor, friso, maçaneta, apoio de braço, bolsa, alto-falante),
    o lado do passageiro (saída de ar, porta-luvas) e a coluna de direção atrás do volante."""
    H, W = a.shape

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            rgb[y, x] = hexrgb(c)
            a[y, x] = 255

    def clear(x, y):
        if 0 <= x < W and 0 <= y < H:
            a[y, x] = 0

    top_l = int(np.argmax(a[:, art_l + 30] > 0))  # topo do painel logo à direita da coluna da porta
    top_r = int(np.argmax(a[:, art_r - 1] > 0))
    # ---- porta do motorista: as linhas descem para a esquerda (perspectiva) ----
    for x in range(0, art_l):
        sill = top_l + 2 + int(round((art_l - x) * 0.22))
        for y in range(H):
            d = y - sill
            if d < 0:
                clear(x, y)
                continue
            c = '#2a2c30'
            if d == 0: c = '#6a6c70'
            elif d <= 2: c = '#4a4c50'
            elif d == 3: c = '#141517'
            elif d == 7: c = '#5e3422'
            elif 8 <= d <= 9: c = '#49271b'
            elif d == 10: c = '#2e180f'
            elif d == 24: c = '#46484c'
            elif 25 <= d <= 32: c = '#34363a'
            elif d == 33: c = '#141517'
            elif 34 <= d <= 43: c = '#222428'
            elif d == 44: c = '#3a3c40'
            elif 45 <= d <= 52: c = '#121314'
            elif d > 52: c = '#1c1e20'
            put(x, y, c)
        put(x, sill + 4, '#202226')
    # fresta entre a porta e o painel
    for y in range(top_l + 2, H):
        put(art_l - 1, y, '#0e0f10')
    # maçaneta (perto da frente da porta)
    for x in range(art_l - 26, art_l - 14):
        sill = top_l + 2 + int(round((art_l - x) * 0.22))
        for d in range(14, 18):
            put(x, sill + d, '#141517')
        put(x, sill + 15, '#a0a2a6')
        put(x, sill + 16, '#6a6c70')
    # botões do vidro elétrico no apoio de braço
    for x in range(art_l - 66, art_l - 44):
        sill = top_l + 2 + int(round((art_l - x) * 0.22))
        for d in range(26, 29):
            put(x, sill + d, '#0e0f10')
        if (x - (art_l - 66)) % 6 in (1, 2, 3):
            put(x, sill + 27, '#8a8c90')
    # alto-falante embaixo, com furinhos
    cx = art_l - 92
    cy = top_l + 2 + int(round(92 * 0.22)) + 64
    for y in range(cy - 11, cy + 12):
        for x in range(cx - 10, cx + 11):
            q = ((x - cx) / 10) ** 2 + ((y - cy) / 11.4) ** 2
            if q <= 1:
                put(x, y, '#2e3034' if q > 0.8 else ('#26282c' if (x + y) % 2 else '#121314'))
    # ---- lado do passageiro: painel continua ----
    for x in range(art_r + 1, W):
        for y in range(H):
            d = y - top_r
            if d < 0:
                clear(x, y)
                continue
            c = '#1c1e20'
            if d <= 1: c = '#5a5c5e'
            elif d <= 5: c = '#4a4c4e'
            elif d <= 7: c = '#2a2c2e'
            elif d == 8: c = '#121416'
            if y == 23: c = '#5e3422'
            elif 24 <= y <= 27: c = '#49271b'
            elif y == 28: c = '#2e180f'
            elif y == 51: c = '#5e3422'
            elif 52 <= y <= 58: c = '#4d2a19'
            elif y == 59: c = '#2e180f'
            elif y == 96: c = '#0c0d0e'
            elif y > 96: c = '#141516'
            put(x, y, c)
    # saída de ar do passageiro
    vx0, vx1 = art_r + 8, min(W - 4, art_r + 46)
    for x in range(vx0, vx1):
        for y in range(31, 47):
            if x in (vx0, vx1 - 1) or y in (31, 46): c = '#3a3c40'
            elif x == (vx0 + vx1) // 2: c = '#2e3034'
            else: c = '#0c0d0e' if y % 2 else '#2a2c2e'
            put(x, y, c)
    # porta-luvas com fecho cromado
    gx0, gx1 = art_r + 6, min(W - 2, art_r + 70)
    for x in range(gx0, gx1):
        for y in range(62, 93):
            if y == 62: c = '#44464a'
            elif y == 92: c = '#0e0f10'
            elif x == gx0: c = '#3a3c40'
            elif x == gx1 - 1: c = '#101113'
            else: c = '#24262a'
            put(x, y, c)
    lx = (gx0 + gx1) // 2
    for x in range(lx - 6, lx + 6):
        put(x, 65, '#0e0f10')
        put(x, 66, '#8a8c90')
    paint_column(rgb, a, pivot, hub)


def paint_column(rgb, a, pivot, hub):
    """Coluna de direção e painel dos joelhos atrás do miolo (aparece quando o volante gira)."""
    H, W = a.shape

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            rgb[y, x] = hexrgb(c)
            a[y, x] = 255

    px, py = pivot
    for y in range(int(py) - 18, H):
        for x in range(W):
            if not hub[y, x]:  # só onde o miolo escondia a arte (as aberturas do volante ficam como na arte)
                continue
            hw = 12 + (y - (py - 18)) * 0.12
            dx = x - px
            if abs(dx) <= hw:
                c = '#2c2e32'
                if dx < -hw + 2: c = '#44464a'
                elif dx > hw - 2: c = '#18191c'
                if y < py - 13: c = '#202124' if abs(dx) < hw - 3 else c
                put(x, y, c)
            elif y > py - 18:
                put(x, y, '#1b1c1f')  # painel embaixo do volante (joelhos)


def paint_pillars(top, dash, pillars):
    """Colunas do para-brisa (a arte corta antes delas): faixas inclinadas do painel até o teto.
    Cada uma: (x no teto, x no painel, linha onde encosta no painel, largura em cima, embaixo),
    em pixels nativos; linhas contadas do teto (topo + painel empilhados)."""
    EXTR = top.shape[0]

    def put(x, y, c):
        img = top if y < EXTR else dash
        yy = y if y < EXTR else y - EXTR
        if 0 <= x < img.shape[1] and 0 <= yy < img.shape[0]:
            img[yy, x, :3] = hexrgb(c)
            img[yy, x, 3] = 255

    for xt, xb, yb, wt, wb in pillars:
        inner = 1 if xb < xt else -1  # lado de dentro (voltado para o centro) recebe a luz
        for y in range(0, int(yb) + 1):
            t = y / yb
            cx, hw = xt + (xb - xt) * t, (wt + (wb - wt) * t) / 2
            x0, x1 = int(round(cx - hw)), int(round(cx + hw))
            for x in range(x0, x1 + 1):
                c = '#26262a'
                if (x == x1 and inner > 0) or (x == x0 and inner < 0): c = '#4c4c52'
                elif (x == x0 and inner > 0) or (x == x1 and inner < 0): c = '#0e0e10'
                elif abs(x - cx) < 1: c = '#2e2e34'
                put(x, y, c)


def paint_mirror(top, dash, art_l, sill_f):
    """Retrovisor externo no canto da frente do vidro lateral, encostado na coluna da porta.
    Ocupa o fim do topo (linhas negativas) e o começo do painel."""
    EXTR = top.shape[0]

    def put(x, y, c):
        img = top if y < 0 else dash
        yy = y + EXTR if y < 0 else y
        if 0 <= x < img.shape[1] and 0 <= yy < img.shape[0]:
            img[yy, x, :3] = hexrgb(c)
            img[yy, x, 3] = 255

    mx0, mx1 = art_l - 20, art_l + 6
    my0, my1 = sill_f - 24, sill_f - 1
    for x in range(mx0, mx1):
        for y in range(my0, my1):
            if min(x - mx0, mx1 - 1 - x) + min(y - my0, my1 - 1 - y) < 2:
                continue  # cantos arredondados
            if x <= mx0 + 1 or x >= mx1 - 2 or y <= my0 + 1 or y >= my1 - 2:
                put(x, y, '#3a3c40' if y == my0 and mx0 + 2 < x < mx1 - 3 else '#141517')
            else:  # vidro: céu claro em cima, estrada escura embaixo (reflexo)
                t = (y - my0) / (my1 - my0)
                put(x, y, '#d0dcea' if t < 0.35 else ('#a8bccc' if t < 0.6 else '#5a6068'))
    for x in range(mx1 - 12, mx1):  # base presa na porta
        for y in range(my1 - 1, sill_f + 2):
            put(x, y, '#1c1d20')


def main():
    src, outdir, car = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = CARS[car]
    full = cv2.imread(src)
    s = cfg['scale']
    px_w, px_h = 1 / s, (1 / s) / (8 / 7)  # px da imagem por pixel nativo
    # área central de 256 colunas começa em xc0; o painel inclui PAD colunas de cada lado
    xc0, y0 = cfg['x0'], cfg['y0']
    x0 = int(round(xc0 - PAD * px_w))
    x1, y1 = int(round(xc0 + (256 + PAD) * px_w)), int(y0 + ROWS * px_h)
    wrows = cfg.get('wheel_rows', ROWS)  # o volante pode ir além da tela (girado, não mostra corte)
    y1w = int(y0 + wrows * px_h)
    pad_x0, pad_x1 = max(0, -x0), max(0, x1 - full.shape[1])
    ty0 = int(round(y0 - EXT * px_h))  # topo das colunas, se vierem da arte
    tpad = max(0, -ty0)
    canvas = cv2.copyMakeBorder(full, tpad, max(0, max(y1, y1w) - full.shape[0]), 0, 0, cv2.BORDER_REPLICATE)
    y0 += tpad
    y1 += tpad  # o recorte do painel também desce (sem isso a arte saía esticada na vertical)
    y1w += tpad
    ty0 += tpad
    # onde a arte acaba nas laterais, espelha (fica natural; repetir a coluna vira listras)
    canvas = cv2.copyMakeBorder(canvas, 0, 0, pad_x0, pad_x1, cv2.BORDER_REFLECT)
    if cfg.get('left') == 'replicate':  # espelhar duplicaria volante e mostrador: repete a borda
        canvas[:, :pad_x0] = canvas[:, pad_x0:pad_x0 + 1]
    if cfg.get('right') == 'replicate' and pad_x1:
        canvas[:, -pad_x1:] = canvas[:, -pad_x1 - 1:-pad_x1]
    padcols = np.zeros(canvas.shape[1], bool)  # colunas que não vêm da arte
    if cfg.get('left') == 'replicate': padcols[:pad_x0] = True
    if cfg.get('right') == 'replicate' and pad_x1: padcols[-pad_x1:] = True
    for side, bands in cfg.get('pad_bands', {}).items():  # porta / painel em faixas lisas (pixel art)
        cols = slice(0, pad_x0) if side == 'left' else slice(canvas.shape[1] - pad_x1, canvas.shape[1])
        for a, b, hexc in bands:
            bgr = [int(hexc[i:i + 2], 16) for i in (5, 3, 1)]
            canvas[max(0, a + tpad):max(0, b + tpad), cols] = bgr
    if 'fill_left' in cfg:  # espelhar daria um "bico" (pilar dobrado): faz uma coluna lisa
        canvas[:, :pad_x0] = cfg['fill_left']
    img = canvas[y0:y1, x0 + pad_x0:x1 + pad_x0].copy()
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]

    def to_crop(x, y):
        return x - x0, y - (y0 - tpad)

    # volante: contornos medidos na arte (tools/ref/wheels/<carro>.json, gerados por
    # wheel_edges.py = bordas do aro, e wheel_spokes.py = polígono dos raios e do cubo)
    geo = json.load(open(os.path.join(os.path.dirname(__file__), 'wheels', f'{car}.json')))
    shift = lambda pts: (np.array(pts, np.float32) - [x0, y0 - tpad]).round().astype(np.int32)
    m_out, m_in, m_sp = (np.zeros((h, w), np.uint8) for _ in range(3))
    cv2.fillPoly(m_out, [shift(geo['outer'])], 1)
    cv2.fillPoly(m_in, [shift(geo['inner'])], 1)
    sp = geo['spokes']
    for q in (sp if isinstance(sp[0][0], list) else [sp]):  # um por vez (sobrepostos não se anulam)
        cv2.fillPoly(m_sp, [shift(q)], 1)
    wheel = (m_out > 0) & ((m_in == 0) | (m_sp > 0))
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # ponteiros vermelhos/laranja dentro dos mostradores principais
    hot = ((hsv[..., 0] <= 18) | (hsv[..., 0] >= 170)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 120)
    gmask = np.zeros((h, w), np.uint8)
    for gx, gy, gr in cfg['gauges'].values():
        cx, cy = to_crop(gx, gy)
        cv2.circle(gmask, (int(cx), int(cy)), int(gr * 0.8), 1, -1)
    needles = cv2.dilate((hot & (gmask > 0)).astype(np.uint8), np.ones((5, 5), np.uint8))

    # fundo do painel: apaga volante e ponteiros
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((7, 7), np.uint8)) | needles
    if 'rim_margin' in cfg:  # o aro medido não bate pixel a pixel: apaga uma faixa mais larga (sem "aro fantasma" ao girar)
        k = cfg['rim_margin']
        rim = ((m_out > 0) & (m_in == 0)).astype(np.uint8)
        hole |= cv2.dilate(rim, np.ones((k, k), np.uint8))
    for (a, b, c, d) in cfg.get('erase', []):
        (a, b), (c, d) = to_crop(a, b), to_crop(c, d)
        hole[max(0, b):max(0, d), max(0, a):max(0, c)] = 1
    # para-brisa: branco ligado à borda de cima fica transparente
    near_white = (img.min(axis=2) > 225).astype(np.uint8)
    ff = near_white.copy()
    msk = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 8):
        if ff[0, x] == 1:
            cv2.floodFill(ff, msk, (x, 0), 2)
    if cfg.get('sky_left'):  # vidro lateral: branco ligado à borda esquerda também é transparente
        for y in range(0, h, 4):
            if ff[y, 0] == 1:
                cv2.floodFill(ff, msk, (0, y), 2)
    sky = ff == 2
    if 'dash_curve' in cfg:  # acima da borda do painel (limpadores, ponta da coluna) é vidro
        sky |= above_curve(cfg['dash_curve'], x0, y0 - tpad, h, w)
    if 'sky_above' in cfg:
        pc = padcols[x0 + pad_x0:x1 + pad_x0]
        rows = np.arange(h) + (y0 - tpad) < cfg['sky_above']
        sky |= rows[:, None] & pc[None, :]
    # atrás do aro: a parte cujo vizinho visível mais próximo é o para-brisa também fica
    # transparente; o resto é reconstruído só a partir do painel (sem o branco escorrer)
    known = (hole == 0) & ~sky
    _, lab = cv2.distanceTransformWithLabels((hole == 0).astype(np.uint8) ^ 1, cv2.DIST_L2, 5,
                                             labelType=cv2.DIST_LABEL_PIXEL)
    seeds = np.zeros(lab.max() + 1, bool)
    seeds[lab[hole == 0]] = sky[hole == 0]
    sky0 = sky
    sky = sky | ((hole > 0) & seeds[lab])
    if 'hole_sky_above' in cfg:  # o aro passa por cima do para-brisa: atrás dele é céu, não painel
        sky |= (hole > 0) & ((yy + (y0 - tpad)) < cfg['hole_sky_above'])
    # ponteiros e lataria vermelhos perto do aro não entram na reconstrução (viram manchas)
    near = cv2.dilate(hole, np.ones((41, 41), np.uint8)) > 0
    fill = cv2.inpaint(img, ((~known) | (hot & near)).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
    dash = np.where(known[..., None], img, fill)
    if 'hub_fill' in cfg:  # o miolo e os raios escondem uma área grande: cor lisa em vez de borrão
        color, ylim = cfg['hub_fill']
        hub = (hole > 0) & (m_in > 0) & ((yy + (y0 - tpad)) > ylim) & ~sky
        dash[hub] = color[::-1]
    # visores de LCD: fundo liso (o conteúdo é desenhado pelo jogo, funcionando)
    for color, (a, b, c, d) in cfg.get('lcd', []):
        (a, b), (c, d) = to_crop(a, b), to_crop(c, d)
        dash[max(0, b):max(0, d), max(0, a):max(0, c)] = color[::-1]

    nw, nh = 256 + 2 * PAD, ROWS
    d_rgb = sample(cv2.cvtColor(dash, cv2.COLOR_BGR2RGB), nw, nh)
    d_a = sample((~sky).astype(np.uint8) * 255, nw, nh)
    if cfg.get('paint') in ('patrol', 'column'):
        pivot_n = ((geo['center'][0] - xc0) / px_w + PAD, (geo['center'][1] - (y0 - tpad)) / px_h)
        hub_n = sample(hub.astype(np.uint8), nw, nh) > 0
        art_l = int(np.ceil(PAD + (0 - xc0) / px_w)) + 1
        art_r = int(np.floor(PAD + (full.shape[1] - xc0) / px_w)) - 1
        if cfg['paint'] == 'patrol':
            paint_patrol(d_rgb, d_a, art_l, art_r, pivot_n, hub_n)
            patrol_mirror = (art_l, int(np.argmax(d_a[:, art_l + 30] > 0)) + 2)
        else:
            paint_column(d_rgb, d_a, pivot_n, hub_n)
    Image.fromarray(np.dstack([d_rgb, d_a]), 'RGBA').save(f'{outdir}/{car}-dash.png')
    # a arte acaba antes do teto: a coluna da porta é prolongada para cima (linha 0 do
    # painel repetida e deslocada pela inclinação da coluna) até a linha 24 da tela
    if 'top_art' in cfg:
        timg = canvas[ty0:y0, x0 + pad_x0:x1 + pad_x0].copy()
        th_, tw_ = timg.shape[:2]
        tsky = (timg.min(axis=2) > 225).astype(np.uint8)
        tm = np.zeros((th_ + 2, tw_ + 2), np.uint8)
        for x in range(0, tw_, 8):
            for yy_ in (0, th_ - 1):
                if tsky[yy_, x] == 1:
                    cv2.floodFill(tsky, tm, (x, yy_), 2)
        if cfg.get('sky_left'):
            for y_ in range(0, th_, 4):
                if tsky[y_, 0] == 1:
                    cv2.floodFill(tsky, tm, (0, y_), 2)
        talpha = tsky != 2
        if 'dash_curve' in cfg:
            talpha &= ~above_curve(cfg['dash_curve'], x0, ty0 - tpad, th_, tw_)
        if 'hole_sky_above' in cfg:  # topo do aro que passa da linha 100: no topo fica só o céu
            tw = np.zeros((th_, tw_), np.uint8)
            cv2.fillPoly(tw, [(np.array(geo['outer'], np.float32) - [x0, ty0 - tpad]).round().astype(np.int32)], 1)
            tw = cv2.dilate(tw, np.ones((cfg.get('rim_margin', 7) + 10,) * 2, np.uint8))
            talpha[tw > 0] = False
        talpha[:, padcols[x0 + pad_x0:x1 + pad_x0]] = False  # acima das colunas repetidas, só céu
        for (a, b, c, d) in cfg['top_art']:
            a, c = a - x0 + pad_x0 - pad_x0, c - x0
            talpha[max(0, b - (ty0 - tpad)):max(0, d - (ty0 - tpad)), max(0, a):max(0, c)] = False
        t_rgb = sample(cv2.cvtColor(timg, cv2.COLOR_BGR2RGB), nw, EXT)
        t_a = sample(talpha.astype(np.uint8) * 255, nw, EXT)
        Image.fromarray(np.dstack([t_rgb, t_a]), 'RGBA').save(f'{outdir}/{car}-top.png')
    if 'pillars' in cfg:
        tp, dp = f'{outdir}/{car}-top.png', f'{outdir}/{car}-dash.png'
        top_i, dash_i = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
        paint_pillars(top_i, dash_i, cfg['pillars'])
        Image.fromarray(top_i, 'RGBA').save(tp)
        Image.fromarray(dash_i, 'RGBA').save(dp)
    if cfg.get('paint') == 'patrol':
        tp, dp = f'{outdir}/{car}-top.png', f'{outdir}/{car}-dash.png'
        top_i, dash_i = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
        paint_mirror(top_i, dash_i, *patrol_mirror)
        Image.fromarray(top_i, 'RGBA').save(tp)
        Image.fromarray(dash_i, 'RGBA').save(dp)
    if 'pillar' in cfg:
        xmax, k = cfg['pillar']
        row = np.dstack([d_rgb, d_a])[0].copy()
        row[PAD + xmax:] = 0
        top = np.zeros((EXT, nw, 4), np.uint8)
        for j in range(EXT):
            d = EXT - j
            shift = int(round(k * d))
            if shift >= nw: continue
            top[j, :nw - shift] = row[shift:]
        Image.fromarray(top, 'RGBA').save(f'{outdir}/{car}-top.png')
    if wrows > ROWS:
        imgw = canvas[y0:y1w, x0 + pad_x0:x1 + pad_x0]
        hw_ = imgw.shape[0]
        wo, wi, ws = (np.zeros((hw_, w), np.uint8) for _ in range(3))
        cv2.fillPoly(wo, [shift(geo['outer'])], 1)
        cv2.fillPoly(wi, [shift(geo['inner'])], 1)
        for q in (sp if isinstance(sp[0][0], list) else [sp]):
            cv2.fillPoly(ws, [shift(q)], 1)
        wsky = np.zeros((hw_, w), bool)
        wsky[:h] = sky0
        wmask = (wo > 0) & ((wi == 0) | (ws > 0)) & ~wsky
        w_rgb = sample(cv2.cvtColor(imgw, cv2.COLOR_BGR2RGB), nw, wrows)
        w_a = sample(wmask.astype(np.uint8) * 255, nw, wrows)
    else:
        w_rgb = sample(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), nw, nh)
        w_a = sample((wheel & ~sky0).astype(np.uint8) * 255, nw, nh)
    Image.fromarray(np.dstack([w_rgb, w_a])[:, PAD:PAD + 256], 'RGBA').save(f'{outdir}/{car}-wheel.png')

    nat = lambda x, y: [round((x - xc0) / px_w, 1), round((y - (y0 - tpad)) / px_h, 1)]
    meta = {'pivot': nat(*geo['center']), 'rows': ROWS, 'pad': PAD}
    for k, (gx, gy, gr) in cfg['gauges'].items():
        meta[k] = nat(gx, gy) + [round(gr / px_w, 1)]
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
