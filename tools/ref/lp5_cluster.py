"""Toro LP5: refaz o quadro de instrumentos com a disposição do Countach de verdade (7 mostradores):
temperatura do óleo e bateria à esquerda, velocímetro, pressão do óleo no meio, conta-giros,
e combustível e temperatura da água à direita. Apaga os 5 aros antigos da arte, repinta o
painel e desenha os aros novos e as caixas de luzes-espia; os mostradores (fundo, escala e
ponteiros) são desenhados pelo jogo (COCKPIT_ART.countach em src/cockpit.ts).

Uso (uma vez, sobre a arte com os 5 aros): python3 tools/ref/lp5_cluster.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(ROOT, 'src/assets/cockpit/countach-dash.png')
PAD, PY = 102, 8 / 7

OLD = [(19.9, 46.6, 15), (57.2, 45.1, 13.5), (107.8, 46.6, 27), (161.6, 45.1, 21.5), (213.6, 46.6, 21)]
# x, y, r (mesmos valores de src/cockpit.ts)
NEW = [(14.2, 42, 13.2), (43.1, 42, 13.2), (84.5, 46.6, 25.4), (128.9, 42, 13.2),
       (173.4, 46.6, 24.8), (213.9, 42, 13.2), (242.4, 42, 13.2)]
PANEL = np.array([28, 28, 27])


def main():
  a = np.array(Image.open(P).convert('RGBA')).astype(np.int32)
  h, w = a.shape[:2]
  yy, xx = np.mgrid[0:h, 0:w]
  X = xx - PAD + 0.5  # centro do pixel em coordenadas da arte
  Y = yy + 0.5

  def ell(cx, cy, r):
    return np.hypot((X - cx - 0.5) / r, (Y - cy - 0.5) / (r * PY))

  clear = np.zeros((h, w), bool)
  for cx, cy, r in OLD:
    clear |= ell(cx, cy, r + 3) <= 1
  clear &= (yy >= 17) & (yy <= 80)
  shade = np.where((xx + yy) % 2 == 0, 0, 2)
  a[clear, :3] = PANEL + shade[clear][:, None]

  # caixas pretas das luzes-espia embaixo dos pequenos (como no carro)
  for x0, x1 in [(2, 56), (201, 256)]:
    box = (X >= x0) & (X < x1) & (Y >= 59) & (Y < 67)
    a[box, :3] = (12, 12, 13)
    a[box & (Y < 60), :3] = (6, 6, 7)
    a[box & (Y >= 66), :3] = (44, 44, 44)
  # parafusos dos dois lados do arco do volante
  for sx in (108.5, 150.5):
    s = (np.abs(X - sx) < 1) & (np.abs(Y - 72) < 1)
    a[s, :3] = (60, 60, 62)

  # aros: anel preto com brilho em cima à esquerda e sombra embaixo; dentro, o fundo do mostrador
  for cx, cy, r in NEW:
    e_in = ell(cx, cy, r)
    ring = (e_in > 1) & (ell(cx, cy, r + 2.2) <= 1)
    a[ring, :3] = (10, 10, 11)
    ang = np.arctan2(Y - cy - 0.5, X - cx - 0.5)
    lit = ring & (ell(cx, cy, r + 1.4) > 1) & (ang < -0.6) & (ang > -2.6)
    a[lit, :3] = (70, 70, 74)
    rim = (e_in > 0.97) & (e_in <= 1)
    a[rim, :3] = (34, 34, 36)
    a[e_in <= 0.97, :3] = (5, 5, 6)
  a[clear, 3] = 255
  Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA').save(P, optimize=True)


if __name__ == '__main__':
  main()
