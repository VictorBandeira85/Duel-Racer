"""Análise dos roncos e buzinas renderizados por tools/qa/sound_check.cjs: tabela (CSV e texto) e folha de
espectrogramas. Por carro: volume (RMS e pico, dBFS) e centroide espectral em marcha lenta, 3000 rpm em carga,
giro máximo e alívio; frequência de explosão esperada (rpm/60 * cilindros/2) x pico medido; e estalos no
roteiro (rampa, troca de marcha, corte de giro, alívio): maior salto entre amostras em relação ao pico.
Uso: python3 tools/qa/sound_report.py <pasta>
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

D = sys.argv[1]
idx = json.load(open(os.path.join(D, 'index.json')))
SR = idx['sr']


def db(v):
    return 20 * np.log10(max(v, 1e-9))


def spectrum(x):
    w = np.hanning(len(x))
    m = np.abs(np.fft.rfft(x * w))
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return f, m


def centroid(x):
    f, m = spectrum(x)
    k = (f > 20) & (f < 12000)
    p = m[k] ** 2
    return float((f[k] * p).sum() / max(p.sum(), 1e-12))


def peak_near(x, f0):
    """pico medido perto da frequência de explosão esperada (±12%) e quanto ele se destaca"""
    f, m = spectrum(x)
    k = (f > f0 * 0.88) & (f < f0 * 1.12)
    if not k.any():
        return 0.0, 0.0
    i = np.argmax(m[k])
    lo = (f > 30) & (f < 1500)
    return float(f[k][i]), float(m[k][i] / max(np.median(m[lo]), 1e-12))


def stft_img(x, h=96, fmax=4000):
    n, hop = 2048, 512
    w = np.hanning(n)
    cols = []
    for i in range(0, len(x) - n, hop):
        m = np.abs(np.fft.rfft(x[i:i + n] * w))
        cols.append(m)
    S = np.array(cols).T
    kmax = int(fmax / (SR / n))
    S = 20 * np.log10(S[:kmax] + 1e-6)
    S = np.clip((S - S.max() + 70) / 70, 0, 1)
    img = Image.fromarray((S[::-1] * 255).astype(np.uint8)).resize((S.shape[1], h), Image.BILINEAR)
    lut = np.array([[int(255 * min(1, v * 1.6)), int(255 * max(0, v * 1.5 - 0.35)), int(255 * (0.25 + 0.4 * v) * (1 - v * 0.6))] for v in np.linspace(0, 1, 256)]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(lut[np.array(img)])


rows, tiles = [], []
for c in idx['cars']:
    x = np.fromfile(os.path.join(D, c['id'] + '.f32'), np.float32).astype(np.float64)
    seg = lambda a, b: x[int((a + 0.4) * SR):int(b * SR)]
    idle, mid, top, over, sweep = seg(0, 2), seg(2, 4), seg(4, 6), seg(6, 8), x[8 * SR:]
    r = {'id': c['id'], 'motor': c['engine'], 'spec': c['name'], 'cil': c['cyl'], 'lenta': c['idle'], 'corte': c['redline']}
    f_idle = c['idle'] / 60 * c['cyl'] / 2
    f_mid = 3000 / 60 * c['cyl'] / 2
    for k, s in (('lenta', idle), ('3000', mid), ('max', top), ('alivio', over)):
        r[f'rms_{k}'] = round(db(np.sqrt((s ** 2).mean())), 1)
        r[f'pico_{k}'] = round(db(np.abs(s).max()), 1)
        r[f'cent_{k}'] = int(centroid(s))
    r['f_lenta_esp'] = round(f_idle, 1)
    r['f_lenta_med'], r['dest_lenta'] = [round(v, 1) for v in peak_near(idle, f_idle)]
    r['f_3000_esp'] = round(f_mid, 1)
    r['f_3000_med'], r['dest_3000'] = [round(v, 1) for v in peak_near(mid, f_mid)]
    d = np.abs(np.diff(sweep))
    r['salto'] = round(float(d.max() / max(np.abs(sweep).max(), 1e-9)), 2)
    r['pico_roteiro'] = round(db(np.abs(sweep).max()), 1)
    rows.append(r)
    im = stft_img(sweep)
    t = Image.new('RGB', (im.width + 8, im.height + 22), (20, 20, 26))
    t.paste(im, (4, 18))
    ImageDraw.Draw(t).text((4, 3), f"{c['id']}  {c['engine']}  cent {r['cent_lenta']}/{r['cent_3000']}/{r['cent_max']} Hz", fill=(240, 230, 200))
    tiles.append(t)

keys = list(rows[0].keys())
with open(os.path.join(D, 'roncos.csv'), 'w') as f:
    f.write(';'.join(keys) + '\n')
    for r in rows:
        f.write(';'.join(str(r[k]) for k in keys) + '\n')
print(f"{'carro':16}{'cil':>4}{'RMS lenta/3000/max/alívio (dBFS)':>36}{'pico max':>10}{'centroide Hz l/3000/max/al':>30}{'f 3000 esp/med':>18}{'salto':>7}")
for r in rows:
    print(f"{r['id']:16}{r['cil']:>4}{r['rms_lenta']:>9}{r['rms_3000']:>9}{r['rms_max']:>9}{r['rms_alivio']:>9}{r['pico_max']:>10}{r['cent_lenta']:>9}{r['cent_3000']:>7}{r['cent_max']:>7}{r['cent_alivio']:>7}{r['f_3000_esp']:>10}{r['f_3000_med']:>8}{r['salto']:>7}")
rm = np.array([r['rms_3000'] for r in rows])
rx = np.array([r['rms_max'] for r in rows])
print(f"\nRMS a 3000 rpm: média {rm.mean():.1f} dBFS, de {rm.min():.1f} a {rm.max():.1f} | no giro máximo: média {rx.mean():.1f}, de {rx.min():.1f} a {rx.max():.1f}")
print('centroide máximo:', max(max(r['cent_3000'], r['cent_max']) for r in rows), 'Hz | maior salto:', max(r['salto'] for r in rows), '| maior pico:', max(r['pico_roteiro'] for r in rows), 'dBFS')

# folha de espectrogramas (roteiro de 5 s: lenta, rampa em carga, troca, corte, alívio; 0-4 kHz)
cols = 3
W = max(t.width for t in tiles)
H = tiles[0].height
sheet = Image.new('RGB', (cols * W, ((len(tiles) + cols - 1) // cols) * H), (20, 20, 26))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * W, (i // cols) * H))
sheet.save(os.path.join(D, 'espectrogramas.png'))

# buzinas
print('\nbuzinas:')
ht = []
for h in idx['horns']:
    x = np.fromfile(os.path.join(D, f"horn-{h['id']}.f32"), np.float32).astype(np.float64)
    s = x[int(0.3 * SR):int(0.85 * SR)]
    f, m = spectrum(s)
    meas = []
    for n in h['notes']:
        k = (f > n * 0.94) & (f < n * 1.06)
        meas.append(round(float(f[k][np.argmax(m[k])]), 1))
    att = np.abs(x[int(0.05 * SR):int(0.2 * SR)])
    env = np.convolve(att, np.ones(220) / 220, 'same')
    t90 = float(np.argmax(env > 0.9 * env.max()) / SR * 1000)
    print(f"  {h['id']:8} notas {h['notes']} medido {meas}  RMS {db(np.sqrt((s ** 2).mean())):.1f} dBFS  pico {db(np.abs(x).max()):.1f}  centroide {int(centroid(s))} Hz  ataque {t90:.0f} ms  salto {np.abs(np.diff(x)).max() / np.abs(x).max():.2f}")
    im = stft_img(x, 64, 4000)
    t = Image.new('RGB', (im.width + 8, im.height + 22), (20, 20, 26))
    t.paste(im, (4, 18))
    ImageDraw.Draw(t).text((4, 3), f"{h['id']} {h['notes']}", fill=(240, 230, 200))
    ht.append(t)
hs = Image.new('RGB', (sum(t.width for t in ht), ht[0].height), (20, 20, 26))
xo = 0
for t in ht:
    hs.paste(t, (xo, 0))
    xo += t.width
hs.save(os.path.join(D, 'buzinas.png'))
