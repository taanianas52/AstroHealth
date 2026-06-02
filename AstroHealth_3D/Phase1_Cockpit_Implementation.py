"""
AstroHealth Cockpit — Phase 1 Implementation Script
====================================================
Run from Blender's Scripting workspace with AstroHealth_Cockpit_Master.blend open.
  Workspace > Scripting > Open > Phase1_Cockpit_Implementation.py > Run Script (Alt+P)

What this script does (NON-DESTRUCTIVE — adds only, never moves/deletes existing objects):
  1. Surveys the existing scene bounding box
  2. Adds rear wall
  3. Adds ceiling panel
  4. Applies glass material to the panoramic window
  5. Builds a procedural deep-space World environment (no external HDRI needed)
  6. Adds three lights (ambient fill, console panel, window spill)
  7. Adds Adam seated placeholder figure

After running: Ctrl+S to save the master file.
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix

# ─────────────────────────────────────────────────────────────────────────────
# SAFETY: Remove any previous Phase 1 objects so the script is re-runnable
# ─────────────────────────────────────────────────────────────────────────────
PHASE1_PREFIX = "PHASE1_"

def remove_previous_phase1():
    names_to_remove = [o.name for o in bpy.data.objects if o.name.startswith(PHASE1_PREFIX)]
    for name in names_to_remove:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    # Also remove Phase1 materials
    mats_to_remove = [m.name for m in bpy.data.materials if m.name.startswith("PHASE1_") or m.name.startswith("MAT_")]
    for name in mats_to_remove:
        m = bpy.data.materials.get(name)
        if m:
            bpy.data.materials.remove(m)
    print("[Phase1] Cleaned up previous run.")

remove_previous_phase1()

scene = bpy.context.scene
col = scene.collection  # root collection


# ─────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def link(obj):
    """Link object to scene root collection if not already linked."""
    if obj.name not in col.objects:
        col.objects.link(obj)

def make_material_hull(name, base_color, metallic=0.55, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    out = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat

def add_plane(name, size_x, size_y, location, rotation=(0,0,0)):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    link(obj)
    bm = bmesh.new()
    # Create plane verts manually so we control exact size
    hx, hy = size_x / 2, size_y / 2
    v1 = bm.verts.new((-hx, -hy, 0))
    v2 = bm.verts.new(( hx, -hy, 0))
    v3 = bm.verts.new(( hx,  hy, 0))
    v4 = bm.verts.new((-hx,  hy, 0))
    bm.faces.new([v1, v2, v3, v4])
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.location = Vector(location)
    obj.rotation_euler = rotation
    return obj

def add_cylinder(name, radius, depth, location, rotation=(0,0,0), verts=16):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cylinder(bm, cap_ends=True, cap_tris=False,
                               segments=verts, radius1=radius, radius2=radius, depth=depth)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.location = Vector(location)
    obj.rotation_euler = rotation
    return obj

def add_sphere(name, radius, location, segments=12, rings=8):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    link(obj)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.location = Vector(location)
    return obj

def add_cube(name, size_x, size_y, size_z, location):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    link(obj)
    bm = bmesh.new()
    bmesh.ops.create_box(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.location = Vector(location)
    obj.scale = (size_x, size_y, size_z)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    return obj

def assign_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — SCENE SURVEY: compute bounding box of all existing mesh objects
# ─────────────────────────────────────────────────────────────────────────────

existing_meshes = [o for o in bpy.data.objects
                   if o.type == 'MESH' and not o.name.startswith(PHASE1_PREFIX)]

if not existing_meshes:
    raise RuntimeError("[Phase1] No existing mesh objects found. Is the correct .blend file open?")

print(f"[Phase1] Found {len(existing_meshes)} existing mesh objects:")
for o in existing_meshes:
    print(f"         • {o.name}  loc={tuple(round(v,3) for v in o.location)}")

# World-space bounding box corners
all_corners = []
for obj in existing_meshes:
    for corner in obj.bound_box:
        world_co = obj.matrix_world @ Vector(corner)
        all_corners.append(world_co)

bb_min = Vector((min(c.x for c in all_corners),
                 min(c.y for c in all_corners),
                 min(c.z for c in all_corners)))
bb_max = Vector((max(c.x for c in all_corners),
                 max(c.y for c in all_corners),
                 max(c.z for c in all_corners)))

bb_size   = bb_max - bb_min
bb_center = (bb_min + bb_max) / 2.0

print(f"[Phase1] Scene bounding box:")
print(f"         MIN  = {tuple(round(v,3) for v in bb_min)}")
print(f"         MAX  = {tuple(round(v,3) for v in bb_max)}")
print(f"         SIZE = {tuple(round(v,3) for v in bb_size)}")

# Derived measurements
WIDTH   = bb_size.x           # cockpit interior width (X)
DEPTH   = bb_size.y           # cockpit interior depth (Y, front-back)
HEIGHT  = bb_size.z           # cockpit interior height (Z)

CX      = bb_center.x         # centre X
CY      = bb_center.y         # centre Y
FLOOR_Z = bb_min.z            # floor level
CEIL_Z  = bb_max.z            # top of tallest existing geometry
REAR_Y  = bb_min.y            # rearmost Y (back of cockpit)
FRONT_Y = bb_max.y            # frontmost Y (window side)

# Margins — keep new elements slightly inside the bounding box edge
WALL_THICKNESS = 0.04

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — REAR WALL
# ─────────────────────────────────────────────────────────────────────────────

rear_wall = add_plane(
    name      = "PHASE1_RearWall",
    size_x    = WIDTH + WALL_THICKNESS * 2,
    size_y    = HEIGHT + WALL_THICKNESS,
    location  = (CX, REAR_Y - WALL_THICKNESS / 2, FLOOR_Z + HEIGHT / 2),
    rotation  = (math.radians(90), 0, 0)   # stand vertical, face forward
)

mat_hull_dark = make_material_hull("PHASE1_MAT_HullDark",
                                    base_color=(0.102, 0.118, 0.141),
                                    metallic=0.55, roughness=0.52)
assign_material(rear_wall, mat_hull_dark)
print("[Phase1] Rear wall added.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — CEILING PANEL
# ─────────────────────────────────────────────────────────────────────────────
# Ceiling spans the full width and most of the depth.
# At the front it stops 15% short of the front edge so it meets the window arc
# without intersecting the curved frame.
CEILING_FRONT_SETBACK = DEPTH * 0.15
CEILING_DEPTH = DEPTH - CEILING_FRONT_SETBACK

ceiling = add_plane(
    name     = "PHASE1_Ceiling",
    size_x   = WIDTH + WALL_THICKNESS * 2,
    size_y   = CEILING_DEPTH,
    location = (CX,
                REAR_Y + CEILING_DEPTH / 2,          # starts at rear, ends before window arc
                CEIL_Z + WALL_THICKNESS / 2),
    rotation = (0, 0, 0)                              # horizontal
)

mat_ceiling = make_material_hull("PHASE1_MAT_Ceiling",
                                  base_color=(0.14, 0.158, 0.18),
                                  metallic=0.3, roughness=0.65)
assign_material(ceiling, mat_ceiling)
print("[Phase1] Ceiling panel added.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — GLASS MATERIAL ON PANORAMIC WINDOW
# ─────────────────────────────────────────────────────────────────────────────
# Heuristic: the window is the object closest to the front (highest Y centre)
# that also has significant height (Z extent > 30% of total height).
# If the scene has a name match we prefer that.

WINDOW_NAME_HINTS = {"window", "glass", "arc", "canopy", "visor", "windshield", "panoram"}

def score_as_window(obj):
    """Return a confidence score that this object is the panoramic window."""
    score = 0
    name_lower = obj.name.lower()
    for hint in WINDOW_NAME_HINTS:
        if hint in name_lower:
            score += 100
    # Prefer objects near the front
    front_bias = (obj.location.y - bb_min.y) / max(DEPTH, 0.001)
    score += front_bias * 30
    # Prefer objects with significant Z extent
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    obj_h = max(c.z for c in corners) - min(c.z for c in corners)
    height_ratio = obj_h / max(HEIGHT, 0.001)
    score += height_ratio * 20
    return score

window_obj = max(existing_meshes, key=score_as_window)
window_score = score_as_window(window_obj)
print(f"[Phase1] Window identified as: '{window_obj.name}' (confidence score: {window_score:.1f})")

# Build glass material
mat_glass = bpy.data.materials.new(name="MAT_CockpitGlass")
mat_glass.use_nodes = True
mat_glass.blend_method = 'BLEND'   # needed for Eevee transparency
mat_glass.shadow_method = 'NONE'
nodes = mat_glass.node_tree.nodes
links = mat_glass.node_tree.links
nodes.clear()

bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.location = (0, 0)
# Dark tinted spacecraft glass — very slight blue tint, near-fully transparent
bsdf.inputs["Base Color"].default_value      = (0.02, 0.04, 0.08, 1.0)
bsdf.inputs["Metallic"].default_value        = 0.0
bsdf.inputs["Roughness"].default_value       = 0.02
bsdf.inputs["IOR"].default_value             = 1.45
bsdf.inputs["Alpha"].default_value           = 0.08

# Transmission — handle both Blender 3.x and 4.x node naming
if "Transmission Weight" in bsdf.inputs:
    bsdf.inputs["Transmission Weight"].default_value = 1.0
elif "Transmission" in bsdf.inputs:
    bsdf.inputs["Transmission"].default_value = 1.0

out = nodes.new("ShaderNodeOutputMaterial")
out.location = (300, 0)
links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

# Assign to window object (clear existing materials first)
window_obj.data.materials.clear()
window_obj.data.materials.append(mat_glass)
print(f"[Phase1] Glass material applied to '{window_obj.name}'.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — PROCEDURAL DEEP-SPACE WORLD ENVIRONMENT
# ─────────────────────────────────────────────────────────────────────────────
# Fully procedural — no external HDRI file required.
# Produces: deep black space + dense starfield + faint Milky Way nebula band.

world = scene.world
if world is None:
    world = bpy.data.worlds.new("AstroHealth_Space_World")
    scene.world = world

world.use_nodes = True
wn = world.node_tree.nodes
wl = world.node_tree.links
wn.clear()

# Node layout (left to right)
tex_coord   = wn.new("ShaderNodeTexCoord");       tex_coord.location   = (-900, 0)
mapping     = wn.new("ShaderNodeMapping");          mapping.location     = (-720, 0)

# Star field — high frequency noise thresholded to sparse points
noise_stars = wn.new("ShaderNodeTexNoise");         noise_stars.location = (-500, 150)
noise_stars.inputs["Scale"].default_value          = 800.0
noise_stars.inputs["Detail"].default_value         = 16.0
noise_stars.inputs["Roughness"].default_value      = 0.7
noise_stars.inputs["Distortion"].default_value     = 0.0
# Threshold — only keep the brightest noise peaks as stars
gt_stars    = wn.new("ShaderNodeMath");             gt_stars.location    = (-280, 150)
gt_stars.operation = 'GREATER_THAN'
gt_stars.inputs[1].default_value = 0.985           # top 1.5% of noise = stars

# Star brightness boost
mult_stars  = wn.new("ShaderNodeMath");             mult_stars.location  = (-80, 150)
mult_stars.operation = 'MULTIPLY'
mult_stars.inputs[1].default_value = 12.0

# Milky Way nebula band — low freq gradient mapped to a sine wave
noise_nebula = wn.new("ShaderNodeTexNoise");        noise_nebula.location = (-500, -150)
noise_nebula.inputs["Scale"].default_value          = 1.8
noise_nebula.inputs["Detail"].default_value         = 8.0
noise_nebula.inputs["Roughness"].default_value      = 0.6
noise_nebula.inputs["Distortion"].default_value     = 1.2

# Very dim — nebula is a faint haze, not bright
mult_neb    = wn.new("ShaderNodeMath");             mult_neb.location    = (-280, -150)
mult_neb.operation = 'MULTIPLY'
mult_neb.inputs[1].default_value = 0.04

# Nebula tint (very dark blue-purple)
neb_col     = wn.new("ShaderNodeMixRGB");           neb_col.location     = (-80, -150)
neb_col.blend_type = 'MULTIPLY'
neb_col.inputs["Color1"].default_value = (0.3, 0.45, 1.0, 1.0)  # blue tint

# Combine stars + nebula over black background
add_node    = wn.new("ShaderNodeMixRGB");           add_node.location    = (160, 0)
add_node.blend_type = 'ADD'
add_node.inputs["Fac"].default_value = 1.0
add_node.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1.0)  # black space

bg_node     = wn.new("ShaderNodeBackground");       bg_node.location     = (380, 0)
bg_node.inputs["Strength"].default_value = 1.2

out_world   = wn.new("ShaderNodeOutputWorld");      out_world.location   = (580, 0)

# Links
wl.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
wl.new(mapping.outputs["Vector"], noise_stars.inputs["Vector"])
wl.new(mapping.outputs["Vector"], noise_nebula.inputs["Vector"])
wl.new(noise_stars.outputs["Fac"], gt_stars.inputs[0])
wl.new(gt_stars.outputs["Value"], mult_stars.inputs[0])
wl.new(noise_nebula.outputs["Fac"], mult_neb.inputs[0])
wl.new(mult_neb.outputs["Value"], neb_col.inputs["Fac"])
wl.new(mult_stars.outputs["Value"], add_node.inputs["Color1"])
wl.new(neb_col.outputs["Color"], add_node.inputs["Color2"])
wl.new(add_node.outputs["Color"], bg_node.inputs["Color"])
wl.new(bg_node.outputs["Background"], out_world.inputs["Surface"])

print("[Phase1] Procedural space world environment set up.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — LIGHTING (3 lights)
# ─────────────────────────────────────────────────────────────────────────────

def add_light(name, light_type, color_hex, energy, location, rotation=(0,0,0), size=1.0):
    r = int(color_hex[0:2], 16) / 255
    g = int(color_hex[2:4], 16) / 255
    b = int(color_hex[4:6], 16) / 255
    light_data = bpy.data.lights.new(name=name, type=light_type)
    light_data.color = (r, g, b)
    light_data.energy = energy
    if light_type == 'AREA':
        light_data.size = size
    obj = bpy.data.objects.new(name, light_data)
    link(obj)
    obj.location = Vector(location)
    obj.rotation_euler = rotation
    return obj

# Light 1 — Deep blue ambient fill (simulates faint light from space through window)
# Positioned above-rear, angled steeply down-forward
add_light(
    name       = "PHASE1_AmbientFill",
    light_type = "SUN",
    color_hex  = "0A1628",
    energy     = 0.15,
    location   = (CX, REAR_Y + DEPTH * 0.3, CEIL_Z + HEIGHT * 0.5),
    rotation   = (math.radians(-30), 0, 0)
)

# Light 2 — Warm amber panel/console light (illuminates console and seat from above)
# Positioned directly above the centre console (front half of cockpit)
CONSOLE_Y = REAR_Y + DEPTH * 0.62   # rough console Y — front half
add_light(
    name       = "PHASE1_ConsolePanelLight",
    light_type = "AREA",
    color_hex  = "FFD080",
    energy     = 8.0,
    location   = (CX, CONSOLE_Y, CEIL_Z - HEIGHT * 0.1),
    rotation   = (0, 0, 0),   # faces straight down
    size       = WIDTH * 0.55
)

# Light 3 — Cold blue-white window spill (simulates space light entering through glass)
# Positioned just in front of the window glass, facing inward (toward rear)
add_light(
    name       = "PHASE1_WindowSpill",
    light_type = "AREA",
    color_hex  = "C8E0FF",
    energy     = 3.0,
    location   = (CX, FRONT_Y - DEPTH * 0.05, FLOOR_Z + HEIGHT * 0.55),
    rotation   = (0, math.radians(180), 0),   # face toward rear (inward)
    size       = WIDTH * 0.75
)

print("[Phase1] Three lights added: AmbientFill, ConsolePanelLight, WindowSpill.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — ADAM SEATED PLACEHOLDER FIGURE
# ─────────────────────────────────────────────────────────────────────────────
# Approximate seated measurements for a 1.80m adult:
#   Seated height (floor to top of head): ~1.28m
#   Hip width: ~0.38m
#   Shoulder width: ~0.46m
# Placed centred on seat X, at the rear-centre of the seat depth.

# Estimate seat position: largest Z-flat object in lower-front region
# Fallback: place Adam at scene centre X, 35% from rear Y, just above floor
ADAM_X  = CX
ADAM_Y  = REAR_Y + DEPTH * 0.38       # slightly toward front (seat position)
ADAM_Z0 = FLOOR_Z                      # floor reference

# Seated body proportions (all in metres)
HIP_W    = 0.19   # half hip width (for leg spread)
S_SEAT   = ADAM_Z0 + HEIGHT * 0.28    # seat cushion height above floor

# Material — bright placeholder orange
mat_adam = bpy.data.materials.new("PHASE1_MAT_AdamPlaceholder")
mat_adam.use_nodes = True
mat_adam.node_tree.nodes.clear()
bsdf_a = mat_adam.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
bsdf_a.inputs["Base Color"].default_value = (0.87, 0.44, 0.19, 1.0)
bsdf_a.inputs["Roughness"].default_value  = 0.9
out_a = mat_adam.node_tree.nodes.new("ShaderNodeOutputMaterial")
mat_adam.node_tree.links.new(bsdf_a.outputs["BSDF"], out_a.inputs["Surface"])

adam_parts = []

def ap(name, obj):
    assign_material(obj, mat_adam)
    adam_parts.append(obj)
    return obj

# --- Pelvis / hips (0.32 × 0.38 × 0.18 m block)
ap("p_pelvis", add_cube("PHASE1_Adam_Pelvis", 0.32, 0.22, 0.18,
    (ADAM_X, ADAM_Y, S_SEAT + 0.09)))

# --- Torso (cylinder r=0.16, h=0.44)
TORSO_BOT = S_SEAT + 0.18
TORSO_TOP = TORSO_BOT + 0.44
ap("p_torso", add_cylinder("PHASE1_Adam_Torso", 0.16, 0.44,
    (ADAM_X, ADAM_Y, TORSO_BOT + 0.22)))

# --- Head (sphere r=0.12)  — allow for helmet clearance
HEAD_Z = TORSO_TOP + 0.06 + 0.12
ap("p_head", add_sphere("PHASE1_Adam_Head", 0.12,
    (ADAM_X, ADAM_Y, HEAD_Z)))

# --- Upper arms (angled slightly down and outward)
ARM_ROT_X = math.radians(15)
ARM_ROT_Z = math.radians(12)
SHOULDER_Z = TORSO_BOT + 0.38

for side, sx in (("L", -1), ("R", 1)):
    ap(f"p_arm_upper_{side}", add_cylinder(
        f"PHASE1_Adam_ArmUpper_{side}", 0.05, 0.32,
        (ADAM_X + sx * 0.24, ADAM_Y, SHOULDER_Z - 0.16),
        rotation=(ARM_ROT_X, 0, sx * ARM_ROT_Z)
    ))

# --- Forearms (angled forward toward console — simulating hand on armrest)
FOREARM_Z = SHOULDER_Z - 0.32 - 0.05
FOREARM_ROT_X = math.radians(40)

for side, sx in (("L", -1), ("R", 1)):
    ap(f"p_arm_fore_{side}", add_cylinder(
        f"PHASE1_Adam_ForeArm_{side}", 0.04, 0.28,
        (ADAM_X + sx * 0.26, ADAM_Y + 0.06, FOREARM_Z - 0.10),
        rotation=(FOREARM_ROT_X, 0, sx * math.radians(8))
    ))

# --- Upper legs (horizontal forward from hips)
for side, sx in (("L", -1), ("R", 1)):
    ap(f"p_leg_upper_{side}", add_cylinder(
        f"PHASE1_Adam_LegUpper_{side}", 0.07, 0.44,
        (ADAM_X + sx * HIP_W, ADAM_Y + 0.22, S_SEAT + 0.05),
        rotation=(0, math.radians(90), 0)   # horizontal pointing forward
    ))

# --- Lower legs (angled down-forward to footrest)
KNEE_Y = ADAM_Y + 0.44
KNEE_Z = S_SEAT + 0.03
LOWER_LEG_ROT_X = math.radians(-50)

for side, sx in (("L", -1), ("R", 1)):
    ap(f"p_leg_lower_{side}", add_cylinder(
        f"PHASE1_Adam_LegLower_{side}", 0.05, 0.38,
        (ADAM_X + sx * HIP_W, KNEE_Y + 0.12, KNEE_Z - 0.19),
        rotation=(LOWER_LEG_ROT_X, 0, 0)
    ))

# --- Join all parts into one object
bpy.ops.object.select_all(action='DESELECT')
for part in adam_parts:
    part.select_set(True)
if adam_parts:
    bpy.context.view_layer.objects.active = adam_parts[0]
    bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = "PHASE1_AdamPlaceholder"

print("[Phase1] Adam placeholder figure added.")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — RENDER ENGINE SETTINGS
# ─────────────────────────────────────────────────────────────────────────────
# Switch to Cycles for accurate glass rendering. Keep samples low for preview.
scene.render.engine = 'CYCLES'
if hasattr(scene, 'cycles'):
    scene.cycles.preview_samples = 32
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True

# Film settings — keep background visible (no transparent background)
scene.render.film_transparent = False

# Enable screen-space reflections hint for Eevee fallback
if hasattr(scene.eevee, 'use_ssr'):
    scene.eevee.use_ssr = True
if hasattr(scene.eevee, 'use_gtao'):
    scene.eevee.use_gtao = True

print("[Phase1] Render engine set to Cycles (128 samples, denoising on).")


# ─────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

print("")
print("=" * 60)
print("  AstroHealth Phase 1 — COMPLETE")
print("=" * 60)
print(f"  Scene bounding box  W={WIDTH:.3f}  D={DEPTH:.3f}  H={HEIGHT:.3f}")
print(f"  Window object       '{window_obj.name}'")
print(f"  New objects added:")
for o in bpy.data.objects:
    if o.name.startswith(PHASE1_PREFIX):
        print(f"    + {o.name}")
print("")
print("  ACTION REQUIRED: Press Ctrl+S to save AstroHealth_Cockpit_Master.blend")
print("=" * 60)
