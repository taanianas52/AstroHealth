"""
AstroHealth Cockpit — Phase 1C: Spacecraft Ceiling Structure
=============================================================
Replaces all flat ceiling placeholders with proper spacecraft interior geometry.

Run from Blender Scripting workspace:
  Scripting > Open > Phase1C_CeilingStructure.py > Alt+P

Objects created (prefix P1C_):
  P1C_CeilingVault        — main barrel-vaulted ceiling surface
  P1C_TransRib_01/02/03   — three curved transverse structural ribs
  P1C_Stringer_L/R        — two longitudinal stringers
  P1C_WallFillet_L/R      — curved quarter-circle wall-ceiling transitions
  P1C_FrontFairing        — curved ceiling-to-window-frame connection strip

Rules:
  • Geometry only — no materials assigned, no lights touched.
  • Never moves / renames / deletes protected objects (seat, window, controls,
    displays, AdamPlaceholder, rear wall, existing lights).
  • Safe to re-run: all P1C_ objects and flat ceiling placeholders are removed
    first, then rebuilt cleanly.
"""

import bpy
import bmesh
import math
from mathutils import Vector

# ─────────────────────────────────────────────────────────────────────────────
# IDENTIFIERS
# ─────────────────────────────────────────────────────────────────────────────
PREFIX     = "P1C_"

# Previous flat/placeholder ceiling objects to remove on re-run
REMOVE_NAMES = {
    "PHASE1_Ceiling",
    "PHASE1B_Ceiling",
    "PHASE1B_Trim_Left",
    "PHASE1B_Trim_Right",
    "PHASE1B_Trim_Rear",
    "PHASE1B_WinCeilTransition",
}
REMOVE_PREFIXES = ("P1C_", "PHASE1B_StructRib",)

# Protected — never touch
PROTECTED_HINTS = {
    "adam", "seat", "window", "glass", "arc", "canopy",
    "console", "display", "control", "light", "lamp",
    "rearwall", "rear_wall",
}

col = bpy.context.scene.collection
vl  = bpy.context.view_layer


# ─────────────────────────────────────────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────────────────────────────────────────
def is_protected(name):
    n = name.lower().replace(" ", "").replace("_", "")
    return any(h in n for h in PROTECTED_HINTS)

def cleanup():
    to_remove = []
    for o in bpy.data.objects:
        if o.name in REMOVE_NAMES:
            to_remove.append(o.name)
            continue
        for pfx in REMOVE_PREFIXES:
            if o.name.startswith(pfx) and not is_protected(o.name):
                to_remove.append(o.name)
                break
    for name in to_remove:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    print(f"[1C] Removed {len(to_remove)} placeholder objects.")

cleanup()


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def link(obj):
    if obj.name not in col.objects:
        col.objects.link(obj)
    return obj

def new_obj(name, bm_data):
    """Create a mesh object from a bmesh, link it, return the object."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    link(obj)
    bm_data.to_mesh(mesh)
    bm_data.free()
    mesh.update()
    return obj

def vault_z(x, cx, w_half, crown, base_z):
    """Barrel-vault Z offset at world X position."""
    nx = (x - cx) / max(w_half, 1e-6)  # −1 … +1
    return base_z + crown * (1.0 - nx * nx)


# ─────────────────────────────────────────────────────────────────────────────
# SCENE SURVEY
# ─────────────────────────────────────────────────────────────────────────────
WINDOW_HINTS = {"window", "glass", "arc", "canopy", "visor", "windshield", "panoram"}

survey_meshes = [
    o for o in bpy.data.objects
    if o.type == 'MESH'
    and not any(o.name.startswith(p) for p in REMOVE_PREFIXES)
    and o.name not in REMOVE_NAMES
]

if not survey_meshes:
    raise RuntimeError("[1C] No mesh objects found. Is the correct file open?")

corners = []
for obj in survey_meshes:
    for c in obj.bound_box:
        corners.append(obj.matrix_world @ Vector(c))

BB_MIN = Vector((min(c.x for c in corners),
                 min(c.y for c in corners),
                 min(c.z for c in corners)))
BB_MAX = Vector((max(c.x for c in corners),
                 max(c.y for c in corners),
                 max(c.z for c in corners)))

W      = BB_MAX.x - BB_MIN.x   # cockpit width
D      = BB_MAX.y - BB_MIN.y   # cockpit depth (front-to-back)
H      = BB_MAX.z - BB_MIN.z   # cockpit height
CX     = (BB_MIN.x + BB_MAX.x) / 2.0
CY     = (BB_MIN.y + BB_MAX.y) / 2.0
Z_FL   = BB_MIN.z              # floor Z
Z_TOP  = BB_MAX.z              # top of existing geometry → ceiling base Z
Y_REAR = BB_MIN.y
Y_FRON = BB_MAX.y
W_HALF = W / 2.0

print(f"[1C] W={W:.3f}  D={D:.3f}  H={H:.3f}  Z_TOP={Z_TOP:.3f}")

# Identify window object (highest confidence heuristic)
def win_score(o):
    s = sum(60 for h in WINDOW_HINTS if h in o.name.lower())
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    obj_h = max(c.z for c in cs) - min(c.z for c in cs)
    front = (o.location.y - Y_REAR) / max(D, 1e-6)
    return s + front * 30 + (obj_h / max(H, 1e-6)) * 20

win_obj  = max(survey_meshes, key=win_score)
win_cs   = [win_obj.matrix_world @ Vector(c) for c in win_obj.bound_box]
WIN_Z_TOP  = max(c.z for c in win_cs)
WIN_Y_REAR = min(c.y for c in win_cs)   # cockpit-facing Y of window
WIN_X_MIN  = min(c.x for c in win_cs)
WIN_X_MAX  = max(c.x for c in win_cs)
WIN_CX     = (WIN_X_MIN + WIN_X_MAX) / 2.0
WIN_W      = WIN_X_MAX - WIN_X_MIN
print(f"[1C] Window: '{win_obj.name}'  WIN_Z_TOP={WIN_Z_TOP:.3f}  WIN_Y_REAR={WIN_Y_REAR:.3f}")


# ─────────────────────────────────────────────────────────────────────────────
# GEOMETRY PARAMETERS
# ─────────────────────────────────────────────────────────────────────────────

VAULT_CROWN   = min(0.10, H * 0.13)  # max vault rise at centreline (≤13% of height)
CEIL_BASE_Z   = Z_TOP                # vault origin Z (at side walls, vault = 0)

# Ceiling spans rear to front — stops just behind the window frame rear face
CEIL_FRONT_Y  = WIN_Y_REAR - 0.015
CEIL_DEPTH    = CEIL_FRONT_Y - Y_REAR

# Fillet: curved quarter-round where ceiling meets side walls
FILLET_R      = min(0.12, W * 0.07)  # radius, capped at 7% of width
FILLET_SEGS   = 6                    # arc segments (6 = smooth enough)

# Transverse ribs (span full width, curved to match vault)
RIB_N         = 3                    # number of ribs
RIB_H         = min(0.06, H * 0.06) # rib height (proud of vault surface)
RIB_T         = min(0.045, D * 0.04)# rib thickness (Y depth)
RIB_ARC_SEGS  = 14                  # arc segments for curved rib soffit

# Longitudinal stringers (run front-to-back, two inner ones)
STR_H         = min(0.038, H * 0.04)# stringer height
STR_W         = min(0.032, W * 0.04)# stringer width
STR_OFFSET    = W_HALF * 0.48       # distance from centreline (symmetric)

# Front fairing (ceiling → window frame transition)
FAIR_SEGS     = 8                   # arc segments for smooth curve
FAIR_T        = 0.04                # fairing thickness

STANDOFF      = 0.003               # how far ribs/stringers stand proud of vault


# ─────────────────────────────────────────────────────────────────────────────
# 1. VAULTED CEILING SURFACE
# ─────────────────────────────────────────────────────────────────────────────
# Geometry: a quad grid with barrel-vault Z displacement applied per vertex.
# Resolution: X_SEGS across width, Y_SEGS along depth.
# The vault formula: Z = CEIL_BASE_Z + VAULT_CROWN * (1 - nx²)
# where nx = (x − CX) / W_HALF  ∈ [−1, +1].

X_SEGS = 16   # higher = smoother vault cross-section
Y_SEGS = 10   # enough for rib bay detail

print(f"[1C] Building vaulted ceiling  ({X_SEGS}×{Y_SEGS} grid) ...")

bm = bmesh.new()

# Create the grid verts manually so we can apply vault before any ops
verts_grid = []
for iy in range(Y_SEGS + 1):
    row = []
    for ix in range(X_SEGS + 1):
        tx = ix / X_SEGS            # 0 → 1 (left to right)
        ty = iy / Y_SEGS            # 0 → 1 (rear to front)
        x  = BB_MIN.x + tx * W
        y  = Y_REAR + ty * CEIL_DEPTH
        z  = vault_z(x, CX, W_HALF, VAULT_CROWN, CEIL_BASE_Z)
        row.append(bm.verts.new((x, y, z)))
    verts_grid.append(row)

# Build quads
for iy in range(Y_SEGS):
    for ix in range(X_SEGS):
        bm.faces.new([
            verts_grid[iy    ][ix    ],
            verts_grid[iy    ][ix + 1],
            verts_grid[iy + 1][ix + 1],
            verts_grid[iy + 1][ix    ],
        ])

bm.normal_update()
obj_vault = new_obj(PREFIX + "CeilingVault", bm)
print(f"[1C]   CeilingVault: {X_SEGS*Y_SEGS} quads, crown={VAULT_CROWN*100:.1f} cm")


# ─────────────────────────────────────────────────────────────────────────────
# 2. TRANSVERSE STRUCTURAL RIBS
# ─────────────────────────────────────────────────────────────────────────────
# Each rib is a solid box-section arch that spans the full cockpit width,
# curved on its underside (soffit) to follow the vault surface, with a flat top.
# This makes the rib look embedded into the hull, not just sitting on top.
#
# Cross-section (looking along Y axis):
#
#    ╔═══════════════════════════════════════╗   ← flat top (at vault_z + STANDOFF + RIB_H)
#    ║                                       ║
#    ╚═══╤═══════════════════════════════╤═══╝   ← curved soffit follows vault(x)
#        │ ←————————— W ————————————→   │
#
# Built by generating front-face and rear-face edge loops, then bridging.

print(f"[1C] Building {RIB_N} transverse ribs ...")

for ri in range(RIB_N):
    t_rib  = (ri + 1) / (RIB_N + 1)          # 0.25 / 0.50 / 0.75 along depth
    rib_y  = Y_REAR + CEIL_DEPTH * t_rib
    name   = PREFIX + f"TransRib_{ri+1:02d}"

    bm = bmesh.new()

    front_bot, front_top = [], []
    rear_bot,  rear_top  = [], []

    for si in range(RIB_ARC_SEGS + 1):
        tx  = si / RIB_ARC_SEGS               # 0 → 1 (left → right)
        x   = BB_MIN.x + tx * W
        z_s = vault_z(x, CX, W_HALF, VAULT_CROWN, CEIL_BASE_Z) + STANDOFF
        z_t = z_s + RIB_H                     # flat-ish top (rises with vault)

        y_f = rib_y + RIB_T / 2               # front face Y
        y_r = rib_y - RIB_T / 2               # rear face Y

        front_bot.append(bm.verts.new((x, y_f, z_s)))
        front_top.append(bm.verts.new((x, y_f, z_t)))
        rear_bot .append(bm.verts.new((x, y_r, z_s)))
        rear_top .append(bm.verts.new((x, y_r, z_t)))

    for si in range(RIB_ARC_SEGS):
        # front face (facing forward / toward window)
        bm.faces.new([front_bot[si], front_bot[si+1],
                      front_top[si+1], front_top[si]])
        # rear face (facing rearward)
        bm.faces.new([rear_bot[si+1], rear_bot[si],
                      rear_top[si],   rear_top[si+1]])
        # top face
        bm.faces.new([front_top[si], front_top[si+1],
                      rear_top[si+1],  rear_top[si]])
        # bottom soffit (curved, follows vault — visible from inside)
        bm.faces.new([rear_bot[si],  rear_bot[si+1],
                      front_bot[si+1], front_bot[si]])

    # Left and right end caps
    bm.faces.new([front_bot[0], rear_bot[0],   rear_top[0],  front_top[0]])
    bm.faces.new([rear_bot[-1], front_bot[-1], front_top[-1], rear_top[-1]])

    bm.normal_update()
    new_obj(name, bm)

print(f"[1C]   Ribs at {[f'{(ri+1)/(RIB_N+1)*100:.0f}%' for ri in range(RIB_N)]} of ceiling depth.")


# ─────────────────────────────────────────────────────────────────────────────
# 3. LONGITUDINAL STRINGERS
# ─────────────────────────────────────────────────────────────────────────────
# Two rectangular-section stringers running front-to-back, symmetric about CX.
# Each sits on the vault surface at a fixed X offset from the centreline.
# Because the vault has a fixed Z at any given X, each stringer is a straight
# bar (no curvature needed along Y).

print(f"[1C] Building longitudinal stringers (offset ±{STR_OFFSET:.3f} m from centre) ...")

for side, sx in (("L", CX - STR_OFFSET), ("R", CX + STR_OFFSET)):
    name   = PREFIX + f"Stringer_{side}"
    z_base = vault_z(sx, CX, W_HALF, VAULT_CROWN, CEIL_BASE_Z) + STANDOFF

    bm = bmesh.new()

    x0, x1 = sx - STR_W / 2, sx + STR_W / 2
    y0, y1 = Y_REAR, CEIL_FRONT_Y
    z0, z1 = z_base, z_base + STR_H

    v = [
        bm.verts.new((x0, y0, z0)),   # 0 rear-left-bot
        bm.verts.new((x1, y0, z0)),   # 1 rear-right-bot
        bm.verts.new((x1, y1, z0)),   # 2 front-right-bot
        bm.verts.new((x0, y1, z0)),   # 3 front-left-bot
        bm.verts.new((x0, y0, z1)),   # 4 rear-left-top
        bm.verts.new((x1, y0, z1)),   # 5 rear-right-top
        bm.verts.new((x1, y1, z1)),   # 6 front-right-top
        bm.verts.new((x0, y1, z1)),   # 7 front-left-top
    ]

    # Faces: bottom, top, rear, front, left, right
    bm.faces.new([v[0], v[1], v[2], v[3]])   # bottom
    bm.faces.new([v[7], v[6], v[5], v[4]])   # top
    bm.faces.new([v[0], v[4], v[5], v[1]])   # rear end cap
    bm.faces.new([v[2], v[6], v[7], v[3]])   # front end cap
    bm.faces.new([v[0], v[3], v[7], v[4]])   # left side
    bm.faces.new([v[1], v[5], v[6], v[2]])   # right side

    bm.normal_update()
    new_obj(name, bm)

print(f"[1C]   Stringers: height={STR_H*1000:.0f} mm  width={STR_W*1000:.0f} mm")


# ─────────────────────────────────────────────────────────────────────────────
# 4. WALL-CEILING CURVED FILLETS
# ─────────────────────────────────────────────────────────────────────────────
# A quarter-circle strip running along the full cockpit depth at each side.
# This removes the hard 90° corner between the vertical side wall and the
# ceiling, replacing it with a smooth curved transition.
#
# The vault is exactly 0 at the side walls (nx = ±1 → vault = 0), so the
# fillet's upper edge meets the ceiling at exactly CEIL_BASE_Z.
#
# Cross-section (looking along Y, left side shown):
#
#   ───────── ceiling ─────────
#  /  ← fillet arc
# │  ← side wall
#
# Arc centre:  (BB_MIN.x + R,  CEIL_BASE_Z − R)
# t=0 point:   (BB_MIN.x,      CEIL_BASE_Z − R)   ← at wall surface
# t=1 point:   (BB_MIN.x + R,  CEIL_BASE_Z)       ← at ceiling surface
# Parametric:  angle 180° → 90°  (counterclockwise from left of centre)

print(f"[1C] Building wall-ceiling fillets (R={FILLET_R*100:.1f} cm, {FILLET_SEGS} segs) ...")

N_Y_FILLET = 6   # segments along Y (6 is plenty for a straight sweep)

for side in ("L", "R"):
    name  = PREFIX + f"WallFillet_{side}"
    bm    = bmesh.new()

    if side == "L":
        wall_x   = BB_MIN.x
        center_x = BB_MIN.x + FILLET_R
    else:
        wall_x   = BB_MAX.x
        center_x = BB_MAX.x - FILLET_R

    center_z = CEIL_BASE_Z - FILLET_R

    # Build the arc profile (in XZ plane)
    def arc_point(t, side=side):
        """t = 0 (at wall) → 1 (at ceiling). Returns (x, z)."""
        if side == "L":
            # angle: 180° → 90° as t: 0 → 1
            angle = math.pi - math.pi / 2 * t
        else:
            # angle: 0° → 90° as t: 0 → 1
            angle = math.pi / 2 * t
        x = center_x + FILLET_R * math.cos(angle)
        z = center_z + FILLET_R * math.sin(angle)
        return (x, z)

    # Y positions spanning the ceiling depth
    y_vals = [Y_REAR + CEIL_DEPTH * (j / N_Y_FILLET) for j in range(N_Y_FILLET + 1)]

    # Build vertex grid: [iy][it]
    vgrid = []
    for y in y_vals:
        row = []
        for si in range(FILLET_SEGS + 1):
            t       = si / FILLET_SEGS
            px, pz  = arc_point(t)
            row.append(bm.verts.new((px, y, pz)))
        vgrid.append(row)

    # Faces
    for iy in range(N_Y_FILLET):
        for si in range(FILLET_SEGS):
            bm.faces.new([
                vgrid[iy    ][si    ],
                vgrid[iy    ][si + 1],
                vgrid[iy + 1][si + 1],
                vgrid[iy + 1][si    ],
            ])

    # End-cap at rear (flat triangle fan would work, but a loop of verts works too)
    # We skip end caps for these — the strips meet the rear wall cleanly

    bm.normal_update()
    new_obj(name, bm)

print(f"[1C]   Fillets: both sides done.")


# ─────────────────────────────────────────────────────────────────────────────
# 5. FRONT FAIRING — CEILING TO WINDOW FRAME TRANSITION
# ─────────────────────────────────────────────────────────────────────────────
# Bridges the gap between:
#   • the ceiling front edge (at Y = CEIL_FRONT_Y, Z = vault(x))
#   • the top of the window frame (at Y = WIN_Y_REAR, Z = WIN_Z_TOP)
#
# This is a curved strip — not flat — that follows a smooth arc in the YZ plane.
# It spans the full window width (WIN_X_MIN → WIN_X_MAX) horizontally.
#
# The arc is defined by 3 points in the YZ plane:
#   P0: (WIN_Y_REAR,    WIN_Z_TOP)           ← bottom of fairing (meets window top)
#   P2: (CEIL_FRONT_Y,  vault_z at WIN_CX)   ← top of fairing (meets ceiling edge)
# We use a quadratic Bezier mid-point to give it a gentle outward bow.

print(f"[1C] Building front fairing (ceiling ↔ window arc) ...")

# Points defining the fairing profile arc (in YZ, X will be swept across WIN_W)
P_bot_y = WIN_Y_REAR
P_bot_z = WIN_Z_TOP
P_top_y = CEIL_FRONT_Y
P_top_z = vault_z(WIN_CX, CX, W_HALF, VAULT_CROWN, CEIL_BASE_Z)

# Quadratic Bezier control point: pulls the arc slightly forward (toward window)
dy = P_top_y - P_bot_y
dz = P_top_z - P_bot_z
ctrl_y = P_bot_y + dy * 0.5 + max(abs(dy), abs(dz)) * 0.12   # slight forward bow
ctrl_z = P_bot_z + dz * 0.5

def bezier_pt(t, p0, ctrl, p2):
    """Quadratic Bezier, returns (y, z)."""
    y = (1-t)**2 * p0[0] + 2*(1-t)*t * ctrl[0] + t**2 * p2[0]
    z = (1-t)**2 * p0[1] + 2*(1-t)*t * ctrl[1] + t**2 * p2[1]
    return (y, z)

P0   = (P_bot_y, P_bot_z)
CTRL = (ctrl_y,  ctrl_z)
P2   = (P_top_y, P_top_z)

# X positions across the window width (+ small overlap onto frame)
FAIR_OVERLAP = 0.015   # fairing slightly overlaps onto window frame each side
x_min_fair = WIN_X_MIN - FAIR_OVERLAP
x_max_fair = WIN_X_MAX + FAIR_OVERLAP
X_SEGS_F   = 8         # segments across width (matches vault resolution)

bm = bmesh.new()
vgrid = []

for xi in range(X_SEGS_F + 1):
    tx   = xi / X_SEGS_F
    x    = x_min_fair + tx * (x_max_fair - x_min_fair)
    col_verts = []
    for ti in range(FAIR_SEGS + 1):
        t       = ti / FAIR_SEGS
        fy, fz  = bezier_pt(t, P0, CTRL, P2)
        col_verts.append(bm.verts.new((x, fy, fz)))
    vgrid.append(col_verts)

# Faces: iterate columns then rows
for xi in range(X_SEGS_F):
    for ti in range(FAIR_SEGS):
        bm.faces.new([
            vgrid[xi    ][ti    ],
            vgrid[xi + 1][ti    ],
            vgrid[xi + 1][ti + 1],
            vgrid[xi    ][ti + 1],
        ])

bm.normal_update()
new_obj(PREFIX + "FrontFairing", bm)
print(f"[1C]   FrontFairing: Bezier arc  Ybot={P_bot_y:.3f} Ztop={P_top_z:.3f}")


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
added = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))

print("")
print("=" * 62)
print("  AstroHealth Phase 1C — Ceiling Structure COMPLETE")
print("=" * 62)
print(f"  Vault crown       {VAULT_CROWN*100:.1f} cm")
print(f"  Fillet radius     {FILLET_R*100:.1f} cm")
print(f"  Rib dims          H={RIB_H*1000:.0f} mm  T={RIB_T*1000:.0f} mm")
print(f"  Stringer dims     H={STR_H*1000:.0f} mm  W={STR_W*1000:.0f} mm")
print(f"  Objects created:")
for n in added:
    print(f"    + {n}")
print("")
print("  No materials assigned. No lights modified.")
print("  ACTION REQUIRED: Ctrl+S to save AstroHealth_Cockpit_Master.blend")
print("=" * 62)
