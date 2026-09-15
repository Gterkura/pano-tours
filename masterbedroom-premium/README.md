# Terrace Parallax Depth Viewer — MASTER BEDROOM

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `kitchen-premium/`, `bathroom-premium/`, `dining-premium/`, `livingground-premium/`
and `living-room-premium/` (THREE.js equirect + RGBD ray-march parallax).

## Room
Master bedroom of the Terrace Residence, **upper level** (floor z 4.20, ceiling z 7.80 — the room
located by raycast: walls at x 3.80 (west, shared with the bathroom) and x 7.70 (east), y 11.73
(north, wardrobe wall) and y 17.17 (south, glazed wall + curtains)). Contents, all identified by
raycast rather than by name: a 2.28 x 2.23 m king bed (base `C-mesh-275`, mattress `C-mesh-263`,
runner/duvet `C-mesh-258` / `C-mesh-264`, sheet `C-mesh-257`, pillows `C-mesh-259` / `C-mesh-260`)
with its head against the east headboard wall `G-Object.905`, two cantilevered bedside units
(`G-Object.906` / `G-Object.907`), a floor-to-ceiling fitted wardrobe on the north wall
(`G-Object.1084` / `G-Object.1083` / `G-Object.1085` with `G-Object.1086-1089` shelves), a mirror and
a wall console on the west wall, a louvered door to the bathroom (x 3.67) and the entry door
(y 11.1), three framed prints, and a carpet (`C-Carpet+v15+(4)#1`, x 4.12..7.42 y 11.80..16.70).

## Camera
`MBPanoCam` in `terrace_rebuild_v1.blend` — loc (5.00, 15.85, 5.75) = floor 4.20 + 1.55 m, rotZ 0°.
Chosen by an 8-direction horizontal raycast search on a 0.05 m grid at eye height over the room's free
floor (stand-on-floor check: down-ray must hit the carpet at 1.55 m): **8/8 directions >= 1.20 m clear
from every wall, minimum 1.20 m, mean 2.36 m**, with the largest furniture stand-off of the set
(0.65 m from the bed/bedding — the best available in a room whose bed occupies the middle 2.3 x 2.5 m).
Under the camera: the carpet at z 4.21. 214 cells of the grid scored 8/8.

## Payload
| file | size |
|---|---|
| `panos/master_bedroom.jpg` (4096x2048, quality 90) | see live check |
| `panos/depth_rgbd.png` (1024x512, 16-bit RG packed) | see live check |
| `thumbs/master_bedroom.jpg` (512x256, in `../tour-nav/thumbs/`) | see live check |

`.jpg` / `.png` are cache-busted with `?v=20260915m` in `tour_v2.html`.

## Depth
`depth_rgbd.png` carries 16-bit depth in R (high byte) + G (low byte), B = sky mask:
`d = (b * 65280 + g * 255) / 65535`, 0..1 with 1.0 = far. `DEPTH_MAX_METERS = 15.0`
in the viewer matches the mapping used to build the field. Field produced by raycasting the scene from
`MBPanoCam` at 1024x512 (`mb_depth_ray.py`, 453.5 s, CPU): min 0.063 / max 0.506 / mean 0.143, 3208
unique values, no sky, validation PASS.

**Projection convention (verified, not assumed).** `u = 0.5 + atan2(dx, dy)/(2*pi)` — the marker-test
convention established in this scene by `lg_conv2.py` (east -> u 0.750, north -> 0.500, west -> 0.251).
The kitchen / bathroom / dining depth scripts used `bearing = (0.5-u)*2*pi`, which mirrors the field
about u = 0.5; this room's field uses the verified convention. Alignment is confirmed two ways:
* named-pixel raycast probes (`mb_align_check.py`): mattress, duvet, mattress edge, bedside unit,
  headboard, wardrobe, carpet, ceiling, west wall, floor, door, sconce — **12/12 PASS, max delta 0.047**;
* a formula-free edge test on the shipped assets (`mb_edgealign.py`): `corr(grad|pano|, grad|depth|)`
  = **+0.2750 as stored vs +0.0470 flipped** => ALIGNED (for reference, published livingground is
  +0.3943 / +0.0368 ALIGNED, while published kitchen +0.026/+0.122, dining +0.093/+0.265 and
  bathroom +0.003/+0.326 test MIRRORED — the known sibling issue, not touched here).

## Lighting
The room had **no lights of its own** (`LIGHTS_IN_ZONE = 0`: of the 45 scene lights none sat inside the
upper-level bedroom volume), so a per-room layer was added and saved into the blend: `MB_Down0..3`
(ceiling downlights at z 7.55), `MB_Head` (warm accent at the bed head), `MB_Fill`. All
`visible_camera=False` so no fixture reads in the pano. Exposure of the shipped 4K: mean luma 145,
99th percentile 193, **0.00 % pixels above 250** (nothing blown).

## Audit
Raycast defect audit from `MBPanoCam` (`mb_audit.py`, 144x72 equirect sweep = 10 368 rays):
* `wd60` leftover: **`[]`** — the translucent tufted-grid chair defect class is fully swept (scene-wide).
* tufted/weave on furniture: **0 hits**.
* translucent on furniture: 3 hits — the north-wall glazing `G-Object.909` / `G-Object.911`
  (`[Color M00]2`, alpha 0.39) and `C-Group#29.005` behind them; the model's standard window glazing,
  assessed legitimate (same material class accepted in every previous room).
* flush slab on the floor: 1 hit — `G-Object.905`, the 6.05 x 0.17 x 1.00 m headboard/wall panel along
  the east wall, floor-anchored built-in joinery; wall-anchored cladding class, legitimate.
* floating objects: 17 flags, **all resolved legitimate by attach raycast** (`mb_d3check.py`): the
  bedside units butt directly onto the headboard panel `G-Object.905` (cantilevered floating drawers,
  confirmed visually at 100 % crop), the west-wall console/mirror are on the wall (stand-off 0.01 m /
  embedded), the sconces are wall-mounted, the wardrobe shelf planes sit inside the wardrobe carcass,
  and the bedding items rest on each other / on the open bed base rails.
* near-black pixels: 0 of 11 612 near-black pixels in the shipped 4K see the background
  (`mb_blackaudit.py` — every one hits real geometry); the few 1-5 px slivers along the draped runner's
  hem are **fully occluded from all six room lights** (`mb_seamprobe.py`), i.e. crevice shadow at the
  drape/sheet contact line, not a mesh tear and not a hole.
**2K proof render PASS** at 100 % crops (bed + both bedside units, wardrobe, window wall, west wall,
doorways, and one full-width band containing all furniture at once): no ghost/translucent furniture,
no missing surfaces, no black holes, nothing floating. **4K ship render re-reviewed at 100 % — PASS.**
**No fix rounds were required** (audit clean on the first pass).

## VR fallback
Desktop parallax is the current mode. `tour_classic.html` (pannellum, standard pano) kept as the
fallback.
