"""Fotos da revista do Toro V12 (Diablo 1994, pixel art do Victor): os emblemas reais viram o logo
da Toro (src/assets/brands.json), o "ALPINE" do rádio e o texto da placa somem, o "Lamborghini"
das tampas do motor vira "Toro". Reduz para 560 x 315.
Uso: python3 tools/ref/diablo_photos.py <pasta com ph-*.png> <src/assets/photos>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

# emblemas: (cx, cy, meia largura, meia altura, lado do logo)
EMB = {
  'salao': [(320, 742, 11, 13, 22), (895, 717, 8, 9, 14)],
  'deserto': [(1202, 469, 7, 8, 14), (1382, 469, 7, 8, 14)],
  'bolonha': [(1042, 608, 17, 11, 18)],
  'console': [(705, 405, 27, 29, 46)],
  'motor': [(598, 580, 52, 46, 40)],
}
# letreiros: retângulo pintado com a cor do fundo (mediana dos pixels escuros ou claros dele)
TXT = {'console': [(438, 176, 532, 198, 'dark')], 'bolonha': [(1026, 716, 1162, 756, 'light')]}
PLATE = {'bolonha': ('TR 1994', (1094, 737), 24)}
# tampas: o selo inteiro (contorno vermelho com o letreiro) é refeito: centro, comprimento, altura,
# ângulo (graus, anti-horário) e corpo do texto
MOTOR = [((966, 233), 236, 40, 17, 34), ((1262, 495), 248, 46, 23, 36)]
OUT = {'salao': 'dia-salao', 'deserto': 'dia-deserto', 'bolonha': 'dia-bolonha', 'console': 'dia-console', 'motor': 'dia-motor'}
FONTS = '/usr/share/fonts/truetype/'


def font(name, size):
  for f in (FONTS + 'dejavu/' + name, FONTS + 'freefont/' + name):
    if os.path.exists(f):
      return ImageFont.truetype(f, size)
  return ImageFont.load_default()


def main():
  src, out = sys.argv[1], sys.argv[2]
  for k, name in OUT.items():
    a = np.array(Image.open(os.path.join(src, f'ph-{k}.png')).convert('RGB'))
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    for x0, y0, x1, y1, mode in TXT.get(k, []):
      reg = a[y0:y1, x0:x1].reshape(-1, 3).astype(int)
      lum = reg.mean(axis=1)
      sel = lum < np.percentile(lum, 50) if mode == 'dark' else lum > np.percentile(lum, 50)
      a[y0:y1, x0:x1] = np.median(reg[sel], axis=0).astype(np.uint8)
    if k == 'motor':
      for (tx, ty), ln, ht, ang, size in MOTOR:
        t = np.radians(ang)
        ux, uy = np.cos(t), -np.sin(t)
        vx, vy = np.sin(t), np.cos(t)

        def rect(l, h):
          return [(tx + sx * ux * l / 2 + sy * vx * h / 2, ty + sx * uy * l / 2 + sy * vy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).polygon(rect(ln + 16, ht + 10), fill=255)
        mk = np.array(m) > 0
        inner = a[mk].astype(int)
        lum = inner.mean(axis=1)
        silver = np.median(inner[(lum > np.percentile(lum, 55)) & (lum < np.percentile(lum, 90))], axis=0).astype(np.uint8)
        a[mk] = silver
        S = 4  # desenha grande e reduz, para o contorno ficar liso
        lay = Image.new('RGBA', ((ln + 40) * S, (ht + 40) * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        cxl, cyl = lay.width / 2, lay.height / 2
        d.rounded_rectangle((cxl - ln * S / 2, cyl - ht * S / 2, cxl + ln * S / 2, cyl + ht * S / 2), radius=ht * S / 2, outline=(196, 28, 30, 255), width=3 * S)
        d.text((cxl, cyl), 'Toro', font=font('FreeSerifBoldItalic.ttf', size * S), fill=(196, 28, 30, 255), anchor='mm')
        lay = lay.rotate(ang, resample=Image.BICUBIC, expand=True)
        lay = lay.resize((lay.width // S, lay.height // S), Image.LANCZOS)
        im = Image.fromarray(a).convert('RGBA')
        im.alpha_composite(lay, (int(tx - lay.width / 2), int(ty - lay.height / 2)))
        a = np.array(im.convert('RGB'))
    for cx, cy, hw, hh, sz in EMB.get(k, []):
      box = (((xx - cx) / (hw + 2)) ** 2 + ((yy - cy) / (hh + 2)) ** 2) <= 1
      ring = ((((xx - cx) / (hw + 6)) ** 2 + ((yy - cy) / (hh + 6)) ** 2) <= 1) & ~box
      a[box] = np.median(a[ring], axis=0).astype(np.uint8)
      lg = logo_img('toro', sz)
      x0, y0 = cx - sz // 2, cy - sz // 2
      msk = lg[..., 3] > 0
      a[y0:y0 + sz, x0:x0 + sz][msk] = lg[..., :3][msk]
    if k in PLATE:
      txt, (tx, ty), size = PLATE[k]
      im = Image.fromarray(a)
      ImageDraw.Draw(im).text((tx, ty), txt, font=font('DejaVuSans-Bold.ttf', size), fill=(28, 28, 34), anchor='mm')
      a = np.array(im)
    im = Image.fromarray(a)
    th = int(round(W * 315 / 560))
    if th < H:
      top = (H - th) // 2
      im = im.crop((0, top, W, top + th))
    im = im.resize((560, 315), Image.LANCZOS).quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(os.path.join(out, f'{name}.png'), optimize=True)
    print(name, im.size)
    if os.environ.get('DBG'):
      Image.fromarray(a).save(os.path.join(os.environ['DBG'], f'full-{k}.png'))


if __name__ == '__main__':
  main()
