"""
AstroHealth Cockpit — Phase 1B Refinement Script
=================================================
Prerequisite: Phase1_Cockpit_Implementation.py must have been run first
              and AstroHealth_Cockpit_Master.blend saved.

Run from Blender Scripting workspace:
  Scripting > Open > Phase1B_Cockpit_Refinement.py > Alt+P

What this script adds / replaces:
  1. Refined ceiling  — panelled grid with inset cells, slight bow, edge rail
  2. Ceiling-to-wall trim strips  — L-profile perimeter connection
  3. Structural arch ribs  — 3 transverse ribs at ceiling level
  4. Window-ceiling transition strip  — curved bridge from ceiling to window frame
  5. Refined glass material  — Blender 4.x-compatible Principled BSDF
  6. Rebuilt space world environment  — denser stars + Milky Way + Earth limb
  7. Refined 5-layer lighting  — ambient / console / window / L-panel / R-panel

NON-DESTRUCTIVE: never moves, renames, or deletes objects whose names
do not start with PHASE1B_ or PHASE1_Ceiling.

After running: Ctrl+S to save.
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix

# ─────────────────────────────────────────────────────────────────────────────
# PREFIXES
# ─────────────────────────────────────────────────────────────────────────────
B_PREFIX   = "PHASE1B_"          # new objects this script creates
OLD_CEIL   = "PHASE1_Ceiling"    # the flat placeholder ceiling to replace

# Protected prefixes — never touch these
PROTECT = ("PHASE1_RearWall", "PHASE1_AdamPlaceholder",
           "PHASE1_AmbientFill", "PHASE1_ConsolePanelLight", "PHASE1_WindowSpill")

# ─────────────────────────────────────────────────────────────────────────────
# CLEANUP: remove previous 1B objects and the placeholder ceiling
# ─────────────────────────────────────────────────────────────────────────────
def remove_previous():
    targets = [o.name for o in bpy.data.objects
               if o.name.startswith(B_PREFIX) or o.name == OLD_CEIL]
    for name in targets:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    mats = [m.name for m in bpy.data.materials if m.name.startswith(B_PREFIX)]
    for name in mats:
        m = bpy.data.materials.get(name)
        if m:
            bpy.data.materials.remove(m)
    print("[1B] Cleaned up previous run.")

remove_previous()

scene  = bpy.context.scene
col    = scene.collection
vl     = bpy.context.view_layer


# ─────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def link(obj):
    if obj.name not in col.objects:
        col.objects.link(obj)
    return obj

def deselect_all():
    bpy.ops.object.select_all(action='DESELECT')

def apply_transforms(obj):
    deselect_all()
    obj.select_set(True)
    vl.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def make_mat(name, base_rgb, metallic=0.0, roughness=0.5, emission=None):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_rgb, 1.0)
    bsdf.inputs["Metallic"].default_value   = metallic
    bsdf.inputs["Roughness"].default_value  = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value  = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.6
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat

def assign_mat(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)

def add_light(name, ltype, hex_col, energy, loc, rot=(0,0,0), size=1.0):
    r = int(hex_col[0:2],16)/255
    g = int(hex_col[2:4],16)/255
    b = int(hex_col[4:6],16)/255
    ld = bpy.data.lights.new(name=name, type=ltype)
    ld.color  = (r,g,b)
    ld.energy = energy
    if ltype == 'AREA':
        ld.size = size
    obj = bpy.data.objects.new(name, ld)
    link(obj)
    obj.location       = Vector(loc)
    obj.rotation_euler = rot
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# SCENE SURVEY
# ─────────────────────────────────────────────────────────────────────────────
WINDOW_HINTS = {"window","glass","arc","canopy","visor","windshield","panoram"}

existing = [o for o in bpy.data.objects
            if o.type == 'MESH'
            and not o.name.startswith(B_PREFIX)
            and o.name not in (OLD_CEIL,)]

if not existing:
    raise RuntimeError("[1B] No existing mesh objects found.")

print(f"[1B] Surveying {len(existing)} mesh objects ...")
corners_all = []
for obj in existing:
    for c in obj.bound_box:
        corners_all.append(obj.matrix_world @ Vector(c))

bb_min = Vector((min(c.x for c in corners_all),
                 min(c.y for c in corners_all),
                 min(c.z for c in corners_all)))
bb_max = Vector((max(c.x for c in corners_all),
                 max(c.y for c in corners_all),
                 max(c.z for c in corners_all)))
bb_sz  = bb_max - bb_min
bb_ctr = (bb_min + bb_max) / 2.0

W      = bb_sz.x         # width
D      = bb_sz.y         # depth front-back
H      = bb_sz.z         # height
CX     = bb_ctr.x
CY     = bb_ctr.y
Z_FL   = bb_min.z        # floor Z
Z_TOP  = bb_max.z        # ceiling Z
Y_REAR = bb_min.y        # rear Y
Y_FRON = bb_max.y        # front Y (window side)

print(f"[1B] BB: W={W:.3f} D={D:.3f} H={H:.3f}  TOP={Z_TOP:.3f}  REAR={Y_REAR:.3f}  FRONT={Y_FRON:.3f}")

# Identify window object
def window_score(obj):
    s = sum(50 for h in WINDOW_HINTS if h in obj.name.lower())
    cs = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    obj_h = max(c.z for c in cs) - min(c.z for c in cs)
    front = (obj.location.y - Y_REAR) / max(D, 1e-6)
    s += front * 25 + (obj_h / max(H, 1e-6)) * 20
    return s

window_obj = max(existing, key=window_score)
print(f"[1B] Window: '{window_obj.name}'")

# Window bounding box in world space
win_cs  = [window_obj.matrix_world @ Vector(c) for c in window_obj.bound_box]
WIN_Z_TOP  = max(c.z for c in win_cs)
WIN_Z_BOT  = min(c.z for c in win_cs)
WIN_Y_REAR = min(c.y for c in win_cs)   # rearmost Y of window (cockpit-facing edge)
WIN_CX     = (max(c.x for c in win_cs) + min(c.x for c in win_cs)) / 2
WIN_W      = max(c.x for c in win_cs) - min(c.x for c in win_cs)

# Ceiling plane reference
CEIL_Z = Z_TOP + 0.01
CEIL_FRONT_Y = WIN_Y_REAR - 0.02    # ceiling stops just before window frame

# Material constants
C_HULL   = (0.106, 0.122, 0.145)    # dark blue-grey hull panel
C_CEIL   = (0.148, 0.165, 0.188)    # slightly lighter ceiling tile
C_RIB    = (0.082, 0.094, 0.112)    # darker structural rib
C_TRIM   = (0.092, 0.106, 0.128)    # perimeter trim


# ─────────────────────────────────────────────────────────────────────────────
# 1. REFINED CEILING — panelled grid with inset cells and slight bow
# ─────────────────────────────────────────────────────────────────────────────
#
# Geometry plan:
#   • Start with a grid of COLS × ROWS quads covering the ceiling area.
#   • Inset each face by 0.018 m to create recessed panel grooves.
#   • Push the inset face down by 0.012 m (panel is set back from rim).
#   • Apply a very gentle downward bow along Y (depth axis) — max 0.06 m.
#   • Add a perimeter edge loop (0.04 m wide) to form a raised outer rim.

COLS = 4    # panel columns across width
ROWS = 3    # panel rows along depth

CEIL_W    = W   + 0.0            # full interior width
CEIL_D    = (CEIL_FRONT_Y - Y_REAR)  # depth from rear to just before window
INSET_AMT = 0.018                # groove inset width
DEPTH_AMT = 0.012                # how far panel faces sink below rim
BOW_AMP   = 0.06                 # max bow at midpoint (metres)

mesh_ceil = bpy.data.meshes.new(B_PREFIX + "Ceiling_mesh")
obj_ceil  = bpy.data.objects.new(B_PREFIX + "Ceiling", mesh_ceil)
link(obj_ceil)

bm = bmesh.new()

# Create grid
bmesh.ops.create_grid(bm, x_segments=COLS, y_segments=ROWS, size=1.0)

# Scale to actual ceiling dimensions
bmesh.ops.scale(bm, vec=(CEIL_W/2, CEIL_D/2, 1.0),
                verts=bm.verts)

# Position at ceiling height, centred correctly
bmesh.ops.translate(bm, vec=(CX, Y_REAR + CEIL_D/2, CEIL_Z),
                    verts=bm.verts)

# Apply downward bow along Y (depth axis) — cosine curve
for v in bm.verts:
    # Normalise Y position within ceiling depth: 0 at rear, 1 at front
    t = (v.co.y - Y_REAR) / max(CEIL_D, 1e-6)
    # Cosine bow: maximum at centre (t=0.5), zero at edges
    bow = BOW_AMP * math.sin(t * math.pi)
    v.co.z -= bow

bm.faces.ensure_lookup_table()

# Inset all faces to create panel grooves
result = bmesh.ops.inset_individual(bm, faces=bm.faces[:],
                                     thickness=INSET_AMT,
                                     depth=0.0,
                                     use_even_offset=True)

# Push inset (inner) faces DOWN by DEPTH_AMT to create recessed panels
# The inset_individual creates new inner faces — they are the ones with
# smaller area than the outer quads. We identify them by checking if their
# centre is away from the bounding perimeter.
bm.faces.ensure_lookup_table()
bm.verts.ensure_lookup_table()

for face in bm.faces:
    fc = face.calc_center_median()
    # A panel face: its centre is not at the edge of the bounding box
    margin = INSET_AMT + 0.005
    is_inner = (fc.x > (CX - CEIL_W/2 + margin) and
                fc.x < (CX + CEIL_W/2 - margin) and
                fc.y > (Y_REAR + margin) and
                fc.y < (Y_REAR + CEIL_D - margin))
    if is_inner:
        for v in face.verts:
            v.co.z -= DEPTH_AMT

bm.to_mesh(mesh_ceil)
bm.free()
mesh_ceil.update()

mat_ceil = make_mat(B_PREFIX + "MAT_Ceiling", C_CEIL, metallic=0.25, roughness=0.62)
assign_mat(obj_ceil, mat_ceil)
print("[1B] Refined ceiling with panel grid added.")


# ─────────────────────────────────────────────────────────────────────────────
# 2. PERIMETER TRIM — L-profile strip connecting ceiling to walls + rear
# ─────────────────────────────────────────────────────────────────────────────
# Created as three thin flat strips:
#   Left side trim, Right side trim, Rear trim
# Each strip is 0.05 m wide and WALL_THICKNESS m thick, placed at ceiling height.

TRIM_W     = 0.05    # width of trim strip (how far it extends from wall inward)
TRIM_T     = 0.04    # thickness of trim strip
TRIM_Z     = CEIL_Z + TRIM_T / 2

mat_trim = make_mat(B_PREFIX + "MAT_Trim", C_TRIM, metallic=0.45, roughness=0.45)

def make_trim_box(name, sx, sy, sz, loc):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    link(obj)
    bm2  = bmesh.new()
    bmesh.ops.create_box(bm2, size=1.0)
    bm2.to_mesh(mesh)
    bm2.free()
    mesh.update()
    obj.location = Vector(loc)
    obj.scale    = (sx, sy, sz)
    deselect_all()
    obj.select_set(True)
    vl.objects.active = obj
    bpy.ops.object.transform_apply(scale=True)
    assign_mat(obj, mat_trim)
    return obj

# Left side trim
make_trim_box(B_PREFIX + "Trim_Left",
              TRIM_W, CEIL_D, TRIM_T,
              (bb_min.x + TRIM_W/2, Y_REAR + CEIL_D/2, TRIM_Z))

# Right side trim
make_trim_box(B_PREFIX + "Trim_Right",
              TRIM_W, CEIL_D, TRIM_T,
              (bb_max.x - TRIM_W/2, Y_REAR + CEIL_D/2, TRIM_Z))

# Rear trim
make_trim_box(B_PREFIX + "Trim_Rear",
              W + TRIM_W*2, TRIM_W, TRIM_T,
              (CX, Y_REAR + TRIM_W/2, TRIM_Z))

print("[1B] Perimeter trim strips added (Left, Right, Rear).")


# ─────────────────────────────────────────────────────────────────────────────
# 3. STRUCTURAL ARCH RIBS — 3 transverse ribs across cockpit width at ceiling
# ─────────────────────────────────────────────────────────────────────────────
# Each rib is a flat rectangular bar:
#   Width = full cockpit width W
#   Height (Z extent) = RIB_H
#   Depth (Y extent) = RIB_T (thin)
# Placed at ceiling level, evenly spaced along depth axis (rear to front).

RIB_H   = 0.06    # rib height (structural depth)
RIB_T   = 0.04    # rib thickness (thin strip)
N_RIBS  = 3

mat_rib = make_mat(B_PREFIX + "MAT_Rib", C_RIB, metallic=0.6, roughness=0.42)

for i in range(N_RIBS):
    # Space ribs evenly: at 25%, 50%, 75% of depth
    t   = (i + 1) / (N_RIBS + 1)
    rib_y = Y_REAR + CEIL_D * t
    # Bow height at this Y position (match ceiling bow)
    t_bow  = (rib_y - Y_REAR) / max(CEIL_D, 1e-6)
    bow_at = BOW_AMP * math.sin(t_bow * math.pi)
    rib_z  = CEIL_Z - bow_at - RIB_H/2

    name = B_PREFIX + f"StructRib_{i+1:02d}"
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    link(obj)
    bm2  = bmesh.new()
    bmesh.ops.create_box(bm2, size=1.0)
    bm2.to_mesh(mesh)
    bm2.free()
    mesh.update()
    obj.location = Vector((CX, rib_y, rib_z))
    obj.scale    = (W/2 + TRIM_W, RIB_T/2, RIB_H/2)
    deselect_all()
    obj.select_set(True)
    vl.objects.active = obj
    bpy.ops.object.transform_apply(scale=True)
    assign_mat(obj, mat_rib)

print(f"[1B] {N_RIBS} structural arch ribs added.")


# ─────────────────────────────────────────────────────────────────────────────
# 4. WINDOW-CEILING TRANSITION STRIP
# ─────────────────────────────────────────────────────────────────────────────
# A flat strip bridging the gap between the ceiling front edge and the
# top of the window frame arc.  Fills the junction and reads as part of
# the pressure hull forehead above the glass.

TRANS_H = abs(CEIL_Z - WIN_Z_TOP) + 0.04    # height of the bridging strip
TRANS_T = 0.04                               # thickness
TRANS_Z = (CEIL_Z + WIN_Z_TOP) / 2.0        # vertical centre

name = B_PREFIX + "WinCeilTransition"
mesh = bpy.data.meshes.new(name + "_mesh")
obj  = bpy.data.objects.new(name, mesh)
link(obj)
bm2  = bmesh.new()
bmesh.ops.create_box(bm2, size=1.0)
bm2.to_mesh(mesh)
bm2.free()
mesh.update()
obj.location = Vector((WIN_CX, CEIL_FRONT_Y + TRANS_T/2, TRANS_Z))
obj.scale    = (WIN_W/2 + 0.04, TRANS_T/2, TRANS_H/2 + 0.02)
deselect_all()
obj.select_set(True)
vl.objects.active = obj
bpy.ops.object.transform_apply(scale=True)
assign_mat(obj, make_mat(B_PREFIX + "MAT_WinTransition", C_HULL,
                          metallic=0.5, roughness=0.48))

print("[1B] Window-ceiling transition strip added.")


# ─────────────────────────────────────────────────────────────────────────────
# 5. REFINED GLASS MATERIAL ON WINDOW
# ─────────────────────────────────────────────────────────────────────────────
# Rebuild the glass material with:
#   - Correct Blender 4.x "Transmission Weight" node input
#   - Very subtle blue-green tint (aerospace optical coating)
#   - Low roughness (0.015) for sharp star reflections
#   - Alpha 0.06 so the panel frame reads but glass appears empty

mat_glass = bpy.data.materials.get("MAT_CockpitGlass")
if mat_glass:
    bpy.data.materials.remove(mat_glass)

mat_glass = bpy.data.materials.new("MAT_CockpitGlass")
mat_glass.use_nodes      = True
mat_glass.blend_method   = 'BLEND'
mat_glass.shadow_method  = 'NONE'
mat_glass.use_backface_culling = False

nt    = mat_glass.node_tree
nt.nodes.clear()

bsdf  = nt.nodes.new("ShaderNodeBsdfPrincipled");  bsdf.location  = (0, 0)
bsdf.inputs["Base Color"].default_value     = (0.01, 0.025, 0.06, 1.0)
bsdf.inputs["Metallic"].default_value       = 0.0
bsdf.inputs["Roughness"].default_value      = 0.015
bsdf.inputs["IOR"].default_value            = 1.45
bsdf.inputs["Alpha"].default_value          = 0.06

# Transmission — support both Blender 3.x and 4.x naming
if "Transmission Weight" in bsdf.inputs:
    bsdf.inputs["Transmission Weight"].default_value = 1.0
elif "Transmission" in bsdf.inputs:
    bsdf.inputs["Transmission"].default_value = 1.0

# Faint specular coat (simulates anti-reflective + UV coating)
if "Coat Weight" in bsdf.inputs:
    bsdf.inputs["Coat Weight"].default_value   = 0.12
    bsdf.inputs["Coat Roughness"].default_value = 0.04
elif "Clearcoat" in bsdf.inputs:
    bsdf.inputs["Clearcoat"].default_value          = 0.12
    bsdf.inputs["Clearcoat Roughness"].default_value = 0.04

out_n = nt.nodes.new("ShaderNodeOutputMaterial");  out_n.location = (300, 0)
nt.links.new(bsdf.outputs["BSDF"], out_n.inputs["Surface"])

window_obj.data.materials.clear()
window_obj.data.materials.append(mat_glass)
print(f"[1B] Refined glass material applied to '{window_obj.name}'.")


# ─────────────────────────────────────────────────────────────────────────────
# 6. REBUILT PROCEDURAL SPACE WORLD
# ─────────────────────────────────────────────────────────────────────────────
# Three-layer environment:
#   Layer A — pure black space (background)
#   Layer B — dense procedural starfield (noise threshold)
#   Layer C — faint Milky Way nebula band (large-scale gradient + colour)
# Plus a very faint Earth-limb glow at the bottom of the sphere
# (simulates orbital view looking down at Earth's terminator edge).

world = scene.world or bpy.data.worlds.new("AstroHealth_Space")
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes
wl = world.node_tree.links
wn.clear()

def wnode(ntype, loc):
    n = wn.new(ntype)
    n.location = loc
    return n

tex_coord  = wnode("ShaderNodeTexCoord",  (-1100, 200))
mapping    = wnode("ShaderNodeMapping",   (-900,  200))

# ── Star field ────────────────────────────────────────────────
noise_s1   = wnode("ShaderNodeTexNoise",  (-680, 350))
noise_s1.inputs["Scale"].default_value     = 900.0
noise_s1.inputs["Detail"].default_value    = 16.0
noise_s1.inputs["Roughness"].default_value = 0.75
noise_s1.inputs["Distortion"].default_value= 0.0

noise_s2   = wnode("ShaderNodeTexNoise",  (-680, 160))   # second layer for variety
noise_s2.inputs["Scale"].default_value     = 400.0
noise_s2.inputs["Detail"].default_value    = 14.0
noise_s2.inputs["Roughness"].default_value = 0.8

gt1        = wnode("ShaderNodeMath",      (-460, 350))
gt1.operation = 'GREATER_THAN'
gt1.inputs[1].default_value = 0.984       # top ~1.6% = bright stars

gt2        = wnode("ShaderNodeMath",      (-460, 160))
gt2.operation = 'GREATER_THAN'
gt2.inputs[1].default_value = 0.990       # top ~1.0% = dimmer stars

mult1      = wnode("ShaderNodeMath",      (-260, 350))
mult1.operation = 'MULTIPLY'
mult1.inputs[1].default_value = 14.0      # bright star intensity

mult2      = wnode("ShaderNodeMath",      (-260, 160))
mult2.operation = 'MULTIPLY'
mult2.inputs[1].default_value = 6.0       # dim star intensity

add_stars  = wnode("ShaderNodeMath",      (-60,  260))
add_stars.operation = 'ADD'
add_stars.use_clamp = False

# Star colour — slightly warm (some stars are orange/red)
star_col   = wnode("ShaderNodeMixRGB",    (100, 260))
star_col.blend_type = 'MULTIPLY'
star_col.inputs["Fac"].default_value = 1.0
star_col.inputs["Color2"].default_value = (1.0, 0.97, 0.92, 1.0)  # warm white

# ── Milky Way nebula band ────────────────────────────────────────
noise_mw   = wnode("ShaderNodeTexNoise",  (-680, -60))
noise_mw.inputs["Scale"].default_value     = 2.2
noise_mw.inputs["Detail"].default_value    = 10.0
noise_mw.inputs["Roughness"].default_value = 0.55
noise_mw.inputs["Distortion"].default_value= 1.8

mult_mw    = wnode("ShaderNodeMath",      (-460, -60))
mult_mw.operation = 'MULTIPLY'
mult_mw.inputs[1].default_value = 0.055   # keep nebula very faint

mw_col     = wnode("ShaderNodeMixRGB",    (-260, -60))
mw_col.blend_type = 'MULTIPLY'
mw_col.inputs["Fac"].default_value = 1.0
mw_col.inputs["Color2"].default_value = (0.28, 0.42, 1.0, 1.0)  # blue-purple

# ── Earth-limb glow (very faint at sphere bottom) ───────────────────
grad_earth = wnode("ShaderNodeTexGradient", (-680, -260))
grad_earth.gradient_type = 'SPHERICAL'
map_earth  = wnode("ShaderNodeMapping",   (-880, -260))
map_earth.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
map_earth.inputs["Scale"].default_value    = (1.0, 0.35, 1.0)

mult_e     = wnode("ShaderNodeMath",      (-460, -260))
mult_e.operation = 'MULTIPLY'
mult_e.inputs[1].default_value = 0.03     # very faint glow

earth_col  = wnode("ShaderNodeMixRGB",    (-260, -260))
earth_col.blend_type = 'MULTIPLY'
earth_col.inputs["Fac"].default_value = 1.0
earth_col.inputs["Color2"].default_value = (0.1, 0.6, 1.0, 1.0)  # Earth blue

# ── Combine all layers ─────────────────────────────────────────────
add_A      = wnode("ShaderNodeMixRGB",    (300, 100))
add_A.blend_type = 'ADD'
add_A.inputs["Fac"].default_value = 1.0
add_A.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1.0)   # black space

add_B      = wnode("ShaderNodeMixRGB",    (480, 0))
add_B.blend_type = 'ADD'
add_B.inputs["Fac"].default_value = 1.0

add_C      = wnode("ShaderNodeMixRGB",    (660, -80))
add_C.blend_type = 'ADD'
add_C.inputs["Fac"].default_value = 1.0

bg_node    = wnode("ShaderNodeBackground", (860, -40))
bg_node.inputs["Strength"].default_value = 1.5

out_w      = wnode("ShaderNodeOutputWorld", (1060, -40))

# Wire up
wl.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
wl.new(mapping.outputs["Vector"], noise_s1.inputs["Vector"])
wl.new(mapping.outputs["Vector"], noise_s2.inputs["Vector"])
wl.new(mapping.outputs["Vector"], noise_mw.inputs["Vector"])
wl.new(tex_coord.outputs["Generated"], map_earth.inputs["Vector"])
wl.new(map_earth.outputs["Vector"], grad_earth.inputs["Vector"])

wl.new(noise_s1.outputs["Fac"], gt1.inputs[0])
wl.new(noise_s2.outputs["Fac"], gt2.inputs[0])
wl.new(gt1.outputs["Value"],   mult1.inputs[0])
wl.new(gt2.outputs["Value"],   mult2.inputs[0])
wl.new(mult1.outputs["Value"], add_stars.inputs[0])
wl.new(mult2.outputs["Value"], add_stars.inputs[1])
wl.new(add_stars.outputs["Value"], star_col.inputs["Fac"])
wl.new(add_stars.outputs["Value"], star_col.inputs["Color1"])

wl.new(noise_mw.outputs["Fac"], mult_mw.inputs[0])
wl.new(mult_mw.outputs["Value"], mw_col.inputs["Fac"])
wl.new(mult_mw.outputs["Value"], mw_col.inputs["Color1"])

wl.new(grad_earth.outputs["Color"], mult_e.inputs[0])
wl.new(mult_e.outputs["Value"], earth_col.inputs["Fac"])
wl.new(mult_e.outputs["Value"], earth_col.inputs["Color1"])

wl.new(star_col.outputs["Color"], add_A.inputs["Color1"])
wl.new(mw_col.outputs["Color"],   add_A.inputs["Color2"])
wl.new(add_A.outputs["Color"],    add_B.inputs["Color1"])
wl.new(earth_col.outputs["Color"],add_B.inputs["Color2"])
wl.new(add_B.outputs["Color"],    add_C.inputs["Color1"])
add_C.inputs["Color2"].default_value = (0.0, 0.0, 0.0, 1.0)
wl.new(add_C.outputs["Color"],    bg_node.inputs["Color"])
wl.new(bg_node.outputs["Background"], out_w.inputs["Surface"])

print("[1B] Rebuilt procedural space world: stars + Milky Way + Earth limb.")


# ─────────────────────────────────────────────────────────────────────────────
# 7. REFINED 5-LAYER LIGHTING
# ─────────────────────────────────────────────────────────────────────────────
# Remove old Phase1 lights (they are being superseded by more precise setup)
for light_name in ("PHASE1_AmbientFill", "PHASE1_ConsolePanelLight", "PHASE1_WindowSpill"):
    obj = bpy.data.objects.get(light_name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

# Derived positions
CONSOLE_Y  = Y_REAR + D * 0.60    # console is roughly 60% from rear
PANEL_L_X  = bb_min.x + W * 0.12  # left panel inner face X
PANEL_R_X  = bb_max.x - W * 0.12  # right panel inner face X
LIGHT_Z    = Z_TOP - 0.06         # just below ceiling

# ── Light 1: Deep-space cold ambient (very low energy sun)
# Simulates diffuse blue illumination from space beyond the window.
add_light(
    B_PREFIX + "Light_SpaceAmbient",
    "SUN", "0D1E3A", 0.12,
    loc=(CX, Y_FRON + D*0.4, Z_TOP + H*0.5),
    rot=(math.radians(-35), 0, 0)
)

# ── Light 2: Console instrument wash (warm amber, illuminates console + pilot hands)
# Large area light slightly above console level, aimed downward.
add_light(
    B_PREFIX + "Light_ConsoleWash",
    "AREA", "FFCE7A", 7.0,
    loc=(CX, CONSOLE_Y, LIGHT_Z),
    rot=(0, 0, 0),
    size=W * 0.50
)

# ── Light 3: Window cold spill (cold blue-white area, faces inward)
# Simulates pale light entering through the glass from space.
add_light(
    B_PREFIX + "Light_WindowSpill",
    "AREA", "BDD9FF", 2.8,
    loc=(CX, Y_FRON - D*0.04, Z_FL + H*0.55),
    rot=(0, math.radians(180), 0),
    size=W * 0.70
)

# ── Light 4: Left side-panel glow (cool teal, simulates screen illumination)
# Small area light in front of left display panel, facing inward.
add_light(
    B_PREFIX + "Light_PanelLeft",
    "AREA", "4DA8C0", 1.8,
    loc=(PANEL_L_X + 0.08, Y_REAR + D*0.48, Z_FL + H*0.55),
    rot=(0, math.radians(-90), 0),   # face right (inward)
    size=H * 0.45
)

# ── Light 5: Right side-panel glow (same cool teal)
add_light(
    B_PREFIX + "Light_PanelRight",
    "AREA", "4DA8C0", 1.8,
    loc=(PANEL_R_X - 0.08, Y_REAR + D*0.48, Z_FL + H*0.55),
    rot=(0, math.radians(90), 0),    # face left (inward)
    size=H * 0.45
)

print("[1B] 5-layer lighting: SpaceAmbient / ConsoleWash / WindowSpill / PanelLeft / PanelRight.")


# ─────────────────────────────────────────────────────────────────────────────
# RENDER SETTINGS (ensure Cycles, good quality for preview)
# ─────────────────────────────────────────────────────────────────────────────
scene.render.engine = 'CYCLES'
if hasattr(scene, 'cycles'):
    scene.cycles.preview_samples = 64
    scene.cycles.samples         = 256
    scene.cycles.use_denoising   = True
    if hasattr(scene.cycles, 'denoiser'):
        scene.cycles.denoiser    = 'OPENIMAGEDENOISE'

# Colour management — Filmic gives more realistic space contrast
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look           = 'Medium High Contrast'

print("[1B] Render: Cycles 256 samples, denoising ON, Filmic Medium High Contrast.")


# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
new_objects = [o.name for o in bpy.data.objects if o.name.startswith(B_PREFIX)]
print("")
print("=" * 62)
print("  AstroHealth Phase 1B — COMPLETE")
print("=" * 62)
for n in sorted(new_objects):
    print(f"    + {n}")
print("")
print("  Cycles 256 samples | Filmic | Denoising ON")
print("  ACTION REQUIRED: Ctrl+S to save AstroHealth_Cockpit_Master.blend")
print("=" * 62)
