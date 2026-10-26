import cv2, numpy as np, sys, json
src, out, cx = sys.argv[1], sys.argv[2], float(sys.argv[3])
half = json.loads(sys.argv[4])  # lado esquerdo, de cima (centro) até embaixo (centro)
poly = half + [[2 * cx - x, y] for x, y in reversed(half)]
json.dump(poly, open(out, 'w'))
vis = cv2.imread(src)
cv2.polylines(vis, [np.array(poly, np.int32)], True, (0, 255, 0), 1)
r = json.load(open(sys.argv[5])) if len(sys.argv) > 5 else None
if r:
    for k in ('outer', 'inner'): cv2.polylines(vis, [np.array(r[k], np.int32)], True, (255, 0, 255), 1)
x0, y0, x1, y1 = map(int, sys.argv[6:10])
cv2.imwrite(out.replace('.json', '.png'), cv2.resize(vis[y0:y1, x0:x1], None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST))
