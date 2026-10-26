"""Interiores (vista do motorista) dos carros desenhados por código.

Gera, por carro: <carro>-dash.png (460x124: área central de 256 + 102 de cada lado),
<carro>-top.png (460x76: colunas até o teto), <carro>-wheel.png (256x124: só o volante)
e as máscaras de carroceria. Imprime as posições dos mostradores para o cockpit.ts.
Coordenadas: x da área central (0..255), y em linhas a partir do topo da arte (y para baixo).
O pixel do SNES é 8:7, então círculos têm raio vertical 8/7 maior.
"""
import json
import math
import sys

from PIL import Image, ImageDraw

from kit import hexrgb, tone

PAD, DW, ROWS, EXT = 102, 460, 124, 76
PY = 8 / 7
BLACK = (10, 10, 12, 255)


class Dash:
    def __init__(self, w, h, body, trim, panel):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.mask = Image.new('L', (w, h), 0)
        self.d, self.md = ImageDraw.Draw(self.im), ImageDraw.Draw(self.mask)
        b = hexrgb(body)
        self.c = {'body': b + (255,), 'body_hi': tone(b, 0.14), 'body_sh': tone(b, -0.14), 'body_sh2': tone(b, -0.26)}
        for k, v in (('trim', trim), ('panel', panel)):
            v = hexrgb(v)
            self.c[k] = v + (255,)
            self.c[k + '_hi'] = tone(v, 0.07)
            self.c[k + '_hi2'] = tone(v, 0.14)
            self.c[k + '_sh'] = tone(v, -0.05)
            self.c[k + '_sh2'] = tone(v, -0.1)

    def col(self, f):
        return self.c[f] if isinstance(f, str) else (f if len(f) == 4 else f + (255,))

    def poly(self, pts, f, xo=PAD):
        q = [(x + xo, y) for x, y in zip(pts[::2], pts[1::2])]
        self.d.polygon(q, fill=self.col(f))
        self.md.polygon(q, fill=255 if isinstance(f, str) and f.startswith('body') else 0)

    def rect(self, x0, y0, x1, y1, f, xo=PAD):
        self.poly([x0, y0, x1, y0, x1, y1, x0, y1], f, xo)

    def line(self, pts, f, w=1, xo=PAD):
        q = [(x + xo, y) for x, y in zip(pts[::2], pts[1::2])]
        self.d.line(q, fill=self.col(f), width=w)
        self.md.line(q, fill=255 if isinstance(f, str) and f.startswith('body') else 0, width=w)

    def ell(self, cx, cy, rx, f, xo=PAD, ry=None):
        ry = rx * PY if ry is None else ry
        box = [cx - rx + xo, cy - ry, cx + rx + xo, cy + ry]
        self.d.ellipse(box, fill=self.col(f))
        self.md.ellipse(box, fill=255 if isinstance(f, str) and f.startswith('body') else 0)

    def dither(self, x0, y0, x1, y1, f, xo=PAD):
        c = self.col(f)
        px = self.im.load()
        for y in range(max(0, y0), min(self.im.height, y1)):
            for x in range(max(0, x0 + xo), min(self.im.width, x1 + xo)):
                if (x + y) % 2 == 0 and px[x, y][3]:
                    px[x, y] = c


def vent(d, x, y, w, h):
    d.rect(x, y, x + w, y + h, BLACK)
    d.rect(x + 1, y + 1, x + w - 1, y + h - 1, (30, 30, 34))
    for k in range(y + 2, y + h - 1, 2):
        d.line([x + 2, k, x + w - 2, k], (64, 64, 70))


def bezel(d, x, y, r):
    d.ell(x + 0.5, y + 0.5, r + 2.5, (24, 24, 28))
    d.ell(x + 0.5, y + 0.5, r + 1.5, (120, 122, 130))
    d.ell(x + 0.5, y + 0.5, r + 0.5, (8, 8, 10))


def interior(cfg):
    d = Dash(DW, ROWS, cfg['color'], cfg['trim'], cfg['panel'])
    top = Dash(DW, EXT, cfg['color'], cfg['trim'], cfg['panel'])
    hood = cfg.get('hood', 10)
    # capô visto pelo para-brisa (em perspectiva)
    d.poly([-30, 22, 286, 22, 270, 22 - hood, 128 + 70, 22 - hood - 2, 128 - 70, 22 - hood - 2, -14, 22 - hood], 'body')
    d.line([128 - 70, 22 - hood - 2, 128 + 70, 22 - hood - 2], 'body_hi')
    d.poly([-30, 22, 286, 22, 280, 22 - hood // 2, -24, 22 - hood // 2], 'body_sh')
    for k in cfg.get('hood_lines', []):
        d.line(k, 'body_sh2')
    # painel: faixa de cima, capa dos mostradores, partes de baixo
    d.poly([-102, 20, 358, 20, 358, 124, -102, 124], 'panel')
    d.line([-102, 20, 358, 20], 'panel_hi2')
    d.line([-102, 21, 358, 21], 'panel_hi')
    d.dither(-102, 22, 358, 30, 'panel_sh')
    d.dither(-102, 32, 358, 124, 'panel_sh2')
    d.poly([-102, 30, 358, 30, 358, 124, -102, 124], 'panel_sh')
    d.line([-102, 30, 358, 30], 'panel_hi')
    b0, b1, bt, bb = cfg['binnacle']
    d.poly([b0 + 6, bt, b1 - 6, bt, b1, bt + 8, b1 + 2, bb, b0 - 2, bb, b0, bt + 8], 'trim')
    d.line([b0 + 6, bt, b1 - 6, bt], 'trim_hi2')
    d.poly([b0 + 4, bt + 4, b1 - 4, bt + 4, b1 - 2, bb - 2, b0 + 2, bb - 2], (8, 8, 10))
    for g in cfg['dials']:
        bezel(d, g['x'], g['y'], g['r'])
    for g in cfg['aux']:
        bezel(d, g['x'], g['y'], g['r'])
    # console central e saídas de ar
    cx0 = cfg.get('console', 200)
    d.poly([cx0, 30, cx0 + 64, 30, cx0 + 70, 124, cx0 - 6, 124], 'trim')
    d.line([cx0, 30, cx0 - 6, 124], 'trim_hi')
    vent(d, cx0 + 6, 36, 24, 10)
    vent(d, cx0 + 34, 36, 24, 10)
    d.rect(cx0 + 8, 56, cx0 + 56, 70, BLACK)                     # rádio
    d.rect(cx0 + 10, 58, cx0 + 40, 63, (40, 60, 40))
    for k in range(4):
        d.rect(cx0 + 10 + k * 8, 65, cx0 + 15 + k * 8, 68, (90, 92, 98))
    d.rect(cx0 + 44, 58, cx0 + 54, 68, (60, 62, 68))
    for k in range(3):
        d.rect(cx0 + 10 + k * 16, 80, cx0 + 20 + k * 16, 86, (50, 50, 56))
        d.rect(cx0 + 13 + k * 16, 82, cx0 + 17 + k * 16, 84, (200, 120, 40) if k == 1 else (120, 122, 128))
    vent(d, 8, 40, 30, 12)
    vent(d, 300, 40, 34, 12)
    d.rect(270, 70, 350, 72, 'panel_hi')                         # porta-luvas
    d.line([270, 96, 350, 96], 'panel_sh2')
    # porta do motorista (área extra à esquerda): vidro (transparente), friso na cor do
    # carro, painel da porta com maçaneta
    d.poly([-102, 0, -24, 0, -12, 26, -102, 40], (0, 0, 0, 0))
    d.d.polygon([(0, 0), (PAD - 24, 0), (PAD - 12, 26), (0, 40)], fill=(0, 0, 0, 0))
    d.md.polygon([(0, 0), (PAD - 24, 0), (PAD - 12, 26), (0, 40)], fill=0)
    d.poly([-102, 40, -12, 26, -6, 30, -102, 46], 'body')
    d.line([-102, 40, -12, 26], 'body_hi')
    d.poly([-102, 46, -6, 30, 0, 124, -102, 124], cfg['door'])
    d.poly([-70, 70, -30, 64, -28, 70, -68, 76], BLACK)
    d.line([-70, 72, -30, 66], (120, 120, 126))
    # retrovisor externo esquerdo
    d.poly([-92, 14, -50, 10, -46, 34, -90, 38], 'body')
    d.line([-92, 14, -50, 10], 'body_hi')
    d.poly([-88, 17, -53, 14, -50, 31, -86, 34], (150, 190, 220))
    d.line([-88, 17, -53, 14], (220, 236, 246))
    d.poly([-50, 24, -38, 28, -38, 32, -48, 30], 'body_sh')
    # coluna esquerda na arte (linhas 0..30) e no topo (até o teto)
    k = cfg.get('pillar_k', 0.42)

    def pillar(dd, y0, y1, yoff):
        # coluna de 26 px: friso externo na cor do carro, acabamento escuro, brilho na borda
        for y in range(y0, y1):
            t = (y1 - y) + yoff  # linhas acima da base da coluna
            xo = -int(round(k * t))
            a, b = PAD + 4 + xo, PAD + 30 + xo
            dd.d.line([(a, y), (b, y)], fill=dd.c['trim'])
            dd.d.line([(a + 5, y), (a + 12, y)], fill=dd.c['trim_hi'])
            dd.d.line([(a, y), (a + 3, y)], fill=dd.c['body'])
            dd.md.line([(a, y), (a + 3, y)], fill=255)
            dd.d.point((b, y), fill=dd.c['trim_hi2'])
            # coluna direita (espelhada em torno do centro da tela)
            ra, rb = PAD + 256 - 30 - xo, PAD + 256 - 4 - xo
            dd.d.line([(ra, y), (rb, y)], fill=dd.c['trim'])
            dd.d.line([(rb - 12, y), (rb - 5, y)], fill=dd.c['trim_hi'])
            dd.d.line([(rb - 3, y), (rb, y)], fill=dd.c['body'])
            dd.md.line([(rb - 3, y), (rb, y)], fill=255)
            dd.d.point((ra, y), fill=dd.c['trim_hi2'])
    pillar(d, 0, 30, 0)
    pillar(top, 0, EXT, 30)
    # volante
    wh = Dash(256, ROWS, cfg['color'], cfg['trim'], cfg['panel'])
    steering(wh, cfg)
    return d, top, wh


def steering(w, cfg):
    px, py, R = 128, cfg.get('pivot_y', 86), cfg.get('wheel_r', 66)
    th = cfg.get('rim', 9)
    rim, rim_hi, rim_sh = (30, 30, 34), (64, 64, 70), (16, 16, 18)
    w.ell(px, py, R + 1, BLACK, xo=0)
    w.ell(px, py, R, rim, xo=0)
    # brilho do aro em cima à esquerda, sombra embaixo à direita
    box = [px - R + 2, py - R * PY + 2, px + R - 2, py + R * PY - 2]
    w.d.arc(box, 190, 290, fill=rim_hi, width=2)
    w.d.arc(box, 10, 120, fill=rim_sh, width=2)
    w.ell(px, py, R - th, BLACK, xo=0)
    w.ell(px, py, R - th - 1, (0, 0, 0, 0), xo=0)
    w.d.ellipse([px - R + th + 1, py - (R - th - 1) * PY, px + R - th - 1, py + (R - th - 1) * PY], fill=(0, 0, 0, 0))
    if cfg.get('marker'):
        w.rect(px - 2, py - R * PY, px + 2, py - (R - th) * PY, cfg['marker'], xo=0)
    style = cfg.get('wheel', 'three')
    spoke = (58, 60, 66)
    hub_r = cfg.get('hub', 16)
    if style == 'three':
        for a in (180, 0, 90):
            ang = math.radians(a)
            x1, y1 = px + math.cos(ang) * (R - th + 1), py + math.sin(ang) * (R - th + 1) * PY
            w.line([px, py, x1, y1], BLACK, 9, xo=0)
            w.line([px, py, x1, y1], spoke, 7, xo=0)
            w.line([px, py - 2, x1, y1 - 2], (84, 86, 92), 1, xo=0)
    elif style == 'four':
        for a in (160, 20, 120, 60):
            ang = math.radians(a)
            x1, y1 = px + math.cos(ang) * (R - th + 1), py + math.sin(ang) * (R - th + 1) * PY
            w.line([px, py, x1, y1], BLACK, 7, xo=0)
            w.line([px, py, x1, y1], spoke, 5, xo=0)
    w.ell(px, py, hub_r + 1, BLACK, xo=0)
    w.ell(px, py, hub_r, cfg.get('pad', (36, 36, 40)), xo=0)
    w.ell(px - 2, py - 2, hub_r - 4, cfg.get('pad_hi', (48, 48, 54)), xo=0)
    if cfg.get('badge'):
        w.ell(px, py, 3, cfg['badge'], xo=0)


def d(x, y, r, mx, labels, tick, red):
    return {'x': x, 'y': y, 'r': r, 'max': mx, 'labels': labels, 'tick': tick, 'red': red}


CARS = {
    'diablo': {
        'color': '#f0c010', 'trim': '#202024', 'panel': '#2c2c32', 'door': (40, 40, 46), 'hood': 6,
        'binnacle': (54, 202, 14, 72), 'console': 206, 'wheel': 'three', 'badge': (240, 192, 16),
        'dials': [d(103, 44, 19, 8, [0, 1, 2, 3, 4, 5, 6, 7, 8], 0.5, 7), d(153, 44, 19, 340, [0, 40, 80, 120, 160, 200, 240, 280, 320], 20, 999)],
        'aux': [{'x': 69, 'y': 36, 'r': 7, 'kind': 'single', 'show': ['oil'], 'icon': 'oil'},
                {'x': 69, 'y': 58, 'r': 7, 'kind': 'single', 'show': ['water'], 'icon': 'temp'},
                {'x': 187, 'y': 36, 'r': 7, 'kind': 'single', 'show': ['oiltemp'], 'icon': 'oil'},
                {'x': 187, 'y': 58, 'r': 7, 'kind': 'single', 'show': ['fuel'], 'icon': 'fuel'}],
        'speedMax': 340,
    },
    'testarossa': {
        'color': '#d01c1c', 'trim': '#1c1c20', 'panel': '#2a2a2e', 'door': (176, 146, 104), 'hood': 7,
        'binnacle': (58, 198, 14, 70), 'console': 204, 'wheel': 'three', 'marker': (230, 200, 40), 'badge': (240, 200, 30),
        'dials': [d(102, 44, 18, 320, [0, 40, 80, 120, 160, 200, 240, 280, 320], 20, 999), d(154, 44, 18, 10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5, 6.8)],
        'aux': [{'x': 128, 'y': 30, 'r': 6, 'kind': 'single', 'show': ['oil'], 'icon': 'oil'},
                {'x': 128, 'y': 56, 'r': 6, 'kind': 'single', 'show': ['water'], 'icon': 'temp'}],
        'speedMax': 320, 'speedFirst': True,
    },
    'countach': {
        'color': '#e8e8e2', 'trim': '#1e1e22', 'panel': '#2a2a30', 'door': (150, 124, 90), 'hood': 5,
        'binnacle': (50, 206, 12, 74), 'console': 210, 'wheel': 'three', 'badge': (220, 180, 40),
        'dials': [d(100, 44, 18, 320, [0, 40, 80, 120, 160, 200, 240, 280, 320], 20, 999), d(156, 44, 18, 8, [0, 1, 2, 3, 4, 5, 6, 7, 8], 0.5, 7)],
        'aux': [{'x': 66, 'y': 30, 'r': 7, 'kind': 'single', 'show': ['oil'], 'icon': 'oil'},
                {'x': 66, 'y': 56, 'r': 7, 'kind': 'single', 'show': ['water'], 'icon': 'temp'},
                {'x': 190, 'y': 30, 'r': 7, 'kind': 'single', 'show': ['oiltemp'], 'icon': 'oil'},
                {'x': 190, 'y': 56, 'r': 7, 'kind': 'single', 'show': ['fuel'], 'icon': 'fuel'}],
        'speedMax': 320, 'speedFirst': True,
    },
    'nsx': {
        'color': '#1a1a1e', 'trim': '#202024', 'panel': '#34343a', 'door': (46, 46, 52), 'hood': 9,
        'binnacle': (54, 202, 14, 70), 'console': 204, 'wheel': 'four', 'hub': 20, 'badge': (200, 200, 210),
        'dials': [d(104, 44, 19, 300, [0, 40, 80, 120, 160, 200, 240, 280], 20, 999), d(152, 44, 19, 9, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.5, 8)],
        'aux': [{'x': 68, 'y': 50, 'r': 7, 'kind': 'single', 'show': ['fuel'], 'icon': 'fuel'},
                {'x': 188, 'y': 50, 'r': 7, 'kind': 'single', 'show': ['water'], 'icon': 'temp'}],
        'speedMax': 300, 'speedFirst': True,
    },
    'viper': {
        'color': '#c81e24', 'trim': '#1e1e22', 'panel': '#30303a', 'door': (56, 56, 64), 'hood': 18,
        'hood_lines': [[60, 12, 90, 6], [196, 12, 166, 6], [118, 10, 138, 10]],
        'binnacle': (60, 196, 16, 70), 'console': 200, 'wheel': 'three', 'hub': 18, 'badge': (200, 30, 30),
        'dials': [d(104, 44, 18, 7, [0, 1, 2, 3, 4, 5, 6, 7], 0.5, 6), d(152, 44, 18, 280, [0, 40, 80, 120, 160, 200, 240, 280], 20, 999)],
        'aux': [{'x': 214, 'y': 48, 'r': 6, 'kind': 'single', 'show': ['oil'], 'icon': 'oil'},
                {'x': 230, 'y': 48, 'r': 6, 'kind': 'single', 'show': ['water'], 'icon': 'temp'},
                {'x': 246, 'y': 48, 'r': 6, 'kind': 'single', 'show': ['fuel'], 'icon': 'fuel'}],
        'speedMax': 280,
    },
}

if __name__ == '__main__':
    out = sys.argv[1]
    meta = {}
    for k, cfg in CARS.items():
        dash, top, wh = interior(cfg)
        for name, pic in (('dash', dash), ('top', top), ('wheel', wh)):
            pic.im.save(f'{out}/{k}-{name}.png')
            if name != 'wheel':
                pic.mask.point(lambda v: 255 if v > 127 else 0).convert('1').save(f'{out}/{k}-{name}-mask.png')
        meta[k] = {'pivot': [128, cfg.get('pivot_y', 86)], 'dials': cfg['dials'], 'aux': cfg['aux'],
                   'speedMax': cfg['speedMax'], 'speedFirst': cfg.get('speedFirst', False)}
    json.dump(meta, open(f'{out}/interiors.json', 'w'), indent=1)
