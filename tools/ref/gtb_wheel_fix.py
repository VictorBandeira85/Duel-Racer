"""Onça GTB: o aro do volante (recortado da arte) levou junto um pedaço do mostrador da água
(ponteiro laranja, marcas brancas) do lado direito. Esse trecho do aro vira o espelho do lado
esquerdo (mesmo raio e altura, o volante é simétrico), cor e transparência.
Uso: gtb_wheel_fix.py src/assets/cockpit/br-pumagtb-wheel.png (rodar uma vez)
"""
import sys
import numpy as np
from PIL import Image

P = sys.argv[1]
a = np.array(Image.open(P).convert('RGBA'))
PX = 127  # eixo do volante (pivot x, em pixels do PNG)
for y in range(56, 100):
    for x in range(200, 240):
        m = 2 * PX - x
        a[y, x] = a[y, m]
Image.fromarray(a).save(P)
