"""Completa o retrovisor externo que a arte corta na borda esquerda, partindo do próprio desenho
(sem trocar por um genérico). Coordenadas no topo+painel empilhados (topo = 76 linhas).
  flip <cabine> ya yb a R m x0 : a faixa da moldura direita (colunas a..R, do começo da curva dos cantos
      até a borda de fora) é refletida e vira a moldura esquerda, com a borda de fora em x0; entre ela e
      a coluna m o meio (moldura de cima, vidro, moldura de baixo) continua igual à coluna m; à esquerda
      de x0 vira janela. Só o retrovisor é refletido (portas nunca).
  shift <cabine> ya yb k m : a moldura esquerda existe mas fica rente à borda: o pedaço 0..m-k anda k
      colunas para a direita (some k colunas do meio do vidro) e as k primeiras viram janela.
Uso: python3 tools/qa/mirror_complete.py flip|shift <cabine> ...
"""
import os
import sys

import numpy as np
from PIL import Image

COCK = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cockpit')


def main():
  mode, name = sys.argv[1], sys.argv[2]
  v = list(map(int, sys.argv[3:]))
  tp, dp = os.path.join(COCK, f'{name}-top.png'), os.path.join(COCK, f'{name}-dash.png')
  t, d = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
  st = np.concatenate([t, d], axis=0)
  old = st.copy()
  if mode == 'flip':
    ya, yb, a, R, m, x0 = v
    rows = slice(ya, yb + 1)
    st[rows, :x0] = 0
    for x in range(a, R + 1):
      st[rows, x0 + (R - x)] = old[rows, x]
    for x in range(x0 + R - a + 1, m):
      st[rows, x] = old[rows, m]
    # contorno escuro do lado de fora da moldura nova
    edge = st[rows, x0, 3] > 0
    col = st[rows, x0 - 1]
    col[edge] = (16, 15, 18, 255)
    st[rows, x0 - 1] = col
  else:
    ya, yb, k, m = v
    rows = slice(ya, yb + 1)
    st[rows, k:m + 1] = old[rows, 0:m + 1 - k]
    st[rows, :k] = 0
  Image.fromarray(st[:t.shape[0]], 'RGBA').save(tp, optimize=True)
  Image.fromarray(st[t.shape[0]:], 'RGBA').save(dp, optimize=True)
  print(name, mode, 'ok')


if __name__ == '__main__':
  main()
