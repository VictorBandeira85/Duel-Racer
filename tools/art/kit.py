"""Kit de desenho de pixel art (sem antialias) para os carros do jogo.

Cada desenho tem a imagem RGBA e uma máscara da carroceria (onde a cor do carro
pode ser trocada no jogo). Coordenadas com y para cima a partir do chão (P = ponto).
"""
import colorsys

from PIL import Image, ImageDraw

OUT = (0, 0, 0, 255)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def tone(rgb, dl, ds=0.0):
    """Clareia/escurece mantendo o matiz (dl em luminosidade HLS)."""
    r, g, b = [v / 255 for v in rgb[:3]]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = min(1, max(0, l + dl))
    s = min(1, max(0, s + ds))
    return tuple(int(round(v * 255)) for v in colorsys.hls_to_rgb(h, l, s)) + (255,)


class Pic:
    def __init__(self, w, h, color):
        self.w, self.h = w, h
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.mask = Image.new('L', (w, h), 0)
        self.d = ImageDraw.Draw(self.im)
        self.md = ImageDraw.Draw(self.mask)
        base = hexrgb(color)
        self.c = {
            'body': base + (255,), 'hi': tone(base, 0.14), 'hi2': tone(base, 0.26),
            'sh': tone(base, -0.12), 'sh2': tone(base, -0.22), 'sh3': tone(base, -0.32),
        }

    def P(self, pts):
        return [(x, self.h - 1 - y) for x, y in zip(pts[::2], pts[1::2])]

    def poly(self, pts, fill, body=False, outline=None):
        f = self.c.get(fill, fill) if isinstance(fill, str) else fill
        self.d.polygon(self.P(pts), fill=f, outline=outline)
        if body:
            self.md.polygon(self.P(pts), fill=255)
        elif fill not in self.c:
            self.md.polygon(self.P(pts), fill=0)

    def rect(self, x0, y0, x1, y1, fill, body=False):
        self.poly([x0, y0, x1, y0, x1, y1, x0, y1], fill, body)

    def line(self, pts, fill, width=1, body=None):
        f = self.c.get(fill, fill) if isinstance(fill, str) else fill
        self.d.line(self.P(pts), fill=f, width=width)
        if body is not None:
            self.md.line(self.P(pts), fill=255 if body else 0, width=width)

    def ellipse(self, cx, cy, rx, ry, fill, body=False):
        box = [cx - rx, self.h - 1 - cy - ry, cx + rx, self.h - 1 - cy + ry]
        f = self.c.get(fill, fill) if isinstance(fill, str) else fill
        self.d.ellipse(box, fill=f)
        self.md.ellipse(box, fill=255 if body else 0)

    def band(self, y0, y1, fill, x0=0, x1=None):
        """Pinta só os pixels de carroceria entre as alturas y0 e y1 (sombreado em faixas)."""
        f = self.c[fill]
        x1 = self.w if x1 is None else x1
        px, mk = self.im.load(), self.mask.load()
        for y in range(max(0, self.h - 1 - y1), min(self.h, self.h - y0)):
            for x in range(max(0, x0), min(self.w, x1)):
                if mk[x, y] and px[x, y][:3] == self.c['body'][:3]:
                    px[x, y] = f

    def edge_light(self, fill='hi2', rows=2):
        """Brilho no contorno de cima da carroceria (1ª linha mais clara, 2ª clara)."""
        px, mk = self.im.load(), self.mask.load()
        for x in range(self.w):
            n = 0
            for y in range(self.h):
                if mk[x, y] and px[x, y][3]:
                    if px[x, y][:3] in (self.c['body'][:3], self.c['sh'][:3]):
                        px[x, y] = self.c[fill] if n == 0 else self.c['hi']
                    n += 1
                    if n >= rows:
                        break
                elif n:
                    break

    def wheel(self, cx, cy, r, style='star5', rim=(206, 208, 214), dark=(70, 72, 80)):
        import math
        self.ellipse(cx, cy, r + 1, r + 1, (10, 10, 12))
        self.ellipse(cx, cy, r, r, (30, 30, 33))
        # banda de rodagem: anel um pouco mais claro embaixo
        self.ellipse(cx, cy, r - 2, r - 2, (44, 44, 48))
        self.ellipse(cx, cy, r - 3, r - 3, (30, 30, 33))
        rr = int(round(r * 0.68))
        self.ellipse(cx, cy, rr + 1, rr + 1, (14, 14, 16))
        self.ellipse(cx, cy, rr, rr, rim + (255,))
        self.ellipse(cx, cy, rr - 2, rr - 2, dark + (255,))
        if style.startswith('star'):
            n = int(style[4:])
            for i in range(n):
                a = -math.pi / 2 + i * 2 * math.pi / n
                for w, col in ((3, rim), (1, (238, 240, 244))):
                    self.line([cx, cy, cx + math.cos(a) * (rr - 1.5), cy + math.sin(a) * (rr - 1.5)], col + (255,), width=w)
        elif style == 'dish':
            # "telefone": disco claro com furos escuros
            self.ellipse(cx, cy, rr - 2, rr - 2, rim + (255,))
            for i in range(5):
                a = -math.pi / 2 + i * 2 * math.pi / 5
                self.ellipse(cx + math.cos(a) * rr * 0.55, cy + math.sin(a) * rr * 0.55, max(1, rr * 0.2), max(1, rr * 0.2), dark + (255,))
        elif style == 'mesh':
            for i in range(10):
                a = i * math.pi / 5
                self.line([cx, cy, cx + math.cos(a) * (rr - 1.5), cy + math.sin(a) * (rr - 1.5)], rim + (255,), width=1)
        self.ellipse(cx, cy, max(1, rr * 0.28), max(1, rr * 0.28), rim + (255,))
        self.ellipse(cx, cy, max(1, rr * 0.12), max(1, rr * 0.12), (60, 60, 66))
        # brilho no pneu (canto de cima à esquerda)
        self.line([cx - r * 0.55, cy + r * 0.62, cx - r * 0.2, cy + r * 0.8], (64, 64, 70, 255))

    def outline(self):
        """Contorno preto de 1 px em volta de tudo que é opaco."""
        px = self.im.load()
        src = self.im.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if 0 <= x + dx < self.w and 0 <= y + dy < self.h and src[x + dx, y + dy][3]:
                        px[x, y] = OUT
                        break

    def save(self, path):
        self.im.save(path)
        self.mask.point(lambda v: 255 if v > 127 else 0).convert('1').save(path.replace('.png', '-mask.png'))
