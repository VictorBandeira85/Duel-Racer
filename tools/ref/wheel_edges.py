import cv2, numpy as np, sys, json
# Bordas do aro por programação dinâmica em coordenadas polares (elípticas)
src, out = sys.argv[1], sys.argv[2]
cx, cy, a, b, n = map(float, sys.argv[3:8])
rng = [tuple(map(float, s.split(':'))) for s in sys.argv[8:10]]  # faixas de rho p/ externa e interna
im = cv2.imread(src).astype(np.float32)
lab = cv2.cvtColor(im / 255, cv2.COLOR_BGR2Lab)
lab = cv2.GaussianBlur(lab, (0, 0), 1.2)
NT, NR = 1440, 400
t = np.linspace(0, 2 * np.pi, NT, endpoint=False)
c, s = np.cos(t), np.sin(t)
ex = a * np.sign(c) * np.abs(c) ** (2 / n); ey = b * np.sign(s) * np.abs(s) ** (2 / n)
def unwrap(r0, r1):
    rho = np.linspace(r0, r1, NR)
    X = (cx + ex[:, None] * rho[None]).astype(np.float32); Y = (cy + ey[:, None] * rho[None]).astype(np.float32)
    P = cv2.remap(lab, X, Y, cv2.INTER_LINEAR)
    d = np.zeros(P.shape[:2], np.float32)
    d[:, 1:-1] = np.linalg.norm(P[:, 2:] - P[:, :-2], axis=2)
    return rho, d, X, Y
def path(cost, smooth=1):
    T, R = cost.shape
    acc = cost.copy(); bp = np.zeros((T, R), int)
    for i in range(1, T):
        prev = acc[i - 1]
        best = np.full(R, -1e9); arg = np.zeros(R, int)
        for k in range(-smooth, smooth + 1):
            sh = np.roll(prev, k)
            if k > 0: sh[:k] = -1e9
            if k < 0: sh[k:] = -1e9
            m = sh - abs(k) * 0.3 > best
            best = np.where(m, sh - abs(k) * 0.3, best); arg = np.where(m, np.arange(R) - k, arg)
        acc[i] = cost[i] + best; bp[i] = arg
    p = np.zeros(T, int); p[-1] = acc[-1].argmax()
    for i in range(T - 1, 0, -1): p[i - 1] = bp[i, p[i]]
    return p
res = {}
vis = cv2.imread(src)
for name, (r0, r1), col in [('outer', rng[0], (0, 255, 0)), ('inner', rng[1], (255, 0, 255))]:
    rho, d, X, Y = unwrap(r0, r1)
    # simetria esquerda/direita: ângulo t e pi - t somam o custo; o caminho começa
    # embaixo (t = -pi/2) e vai até em cima pelo lado direito, depois é espelhado
    idx = np.arange(NT)
    mir = (NT // 2 - idx) % NT
    ds = d + d[mir]
    order = (np.arange(NT // 2 + 1) - NT // 4) % NT   # de -90° a +90°
    ph = path(ds[order])
    p = np.zeros(NT, int)
    p[order] = ph
    p[mir[order]] = ph
    pts = np.stack([X[np.arange(NT), p], Y[np.arange(NT), p]], 1)
    res[name] = pts[::4].round(1).tolist()
    cv2.polylines(vis, [pts.astype(np.int32)], True, col, 1)
json.dump(res, open(out, 'w'))
cv2.imwrite(out.replace('.json', '.png'), vis)
