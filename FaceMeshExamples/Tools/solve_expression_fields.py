"""Solve per-expression Face Mesh motion fields from recorded frames.

Input: Lens Studio log lines written by FaceMeshExamplesDebugFaceMesh (record mode):
  FMREC <frame> N <names...>   FMREC <frame> W <weights...>   FMREC <frame> P <x,y,z,...>
Model per frame f:  P_f = neutral + sum_k w_fk * D_k   (ridge-regularized least squares)
Output (npz): names, neutral (V,3), fields (K,V,3), r2 per expression.
Usage: blender -b --python-exit-code 1 -P solve_expression_fields.py -- log.txt start_offset out.npz
"""
import re
import sys

import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
log, start, out = args[0], int(args[1]), args[2]
with open(log, "rb") as fh:
    fh.seek(start)
    text = fh.read().decode("utf-8", errors="ignore")

frames, names = [], None
cur_w = None
for line in text.splitlines():
    m = re.search(r"FMREC (\d+) ([NWP]) (.*)$", line)
    if not m:
        continue
    kind, val = m.group(2), m.group(3)
    if kind == "N":
        names = val.split(",")
    elif kind == "W":
        cur_w = np.array([float(x) for x in val.split(",")])
    elif kind == "P" and cur_w is not None:
        p = np.array([float(x) for x in val.split(",")])
        frames.append((cur_w, p))
        cur_w = None

W = np.stack([f[0] for f in frames])          # F x K
P = np.stack([f[1] for f in frames])          # F x 3V
F, K = W.shape
V = P.shape[1] // 3
print(f"[solve] {F} frames, {K} expressions, {V} vertices")

# Only solve for expressions that actually vary in the recordings.
std = W.std(axis=0)
active = np.where(std > 0.02)[0]
print("[solve] active expressions:", [names[i] for i in active])
X = np.hstack([np.ones((F, 1)), W[:, active]])  # intercept = neutral
lam = 0.05 * F
A = X.T @ X + lam * np.diag([0.0] + [1.0] * len(active))
B = np.linalg.solve(A, X.T @ P)                 # (1+Ka) x 3V
neutral = B[0].reshape(V, 3)
fields = np.zeros((K, V, 3))
for j, k in enumerate(active):
    fields[k] = B[1 + j].reshape(V, 3)
pred = X @ B
r2 = 1 - ((P - pred) ** 2).sum() / ((P - P.mean(0)) ** 2).sum()
print(f"[solve] overall R^2 = {r2:.3f}")
mag = {names[k]: float(np.linalg.norm(fields[k], axis=1).max()) for k in active}
print("[solve] max displacement per unit weight (cm):", {k: round(v, 2) for k, v in sorted(mag.items(), key=lambda x: -x[1])})
np.savez(out, names=np.array(names), neutral=neutral, fields=fields, active=active)
print("[solve] wrote", out)
