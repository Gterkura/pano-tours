# Terrace Parallax Depth Viewer — LIVING ROOM (GROUND FLOOR)

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `kitchen-premium/`, `bathroom-premium/`, `dining-premium/` and `living-room-premium/`
(THREE.js equirect + RGBD ray-march parallax).

## Room
Ground-floor living room of the Terrace Residence (the **lower** level, floor z 0.60 — this is NOT the
upstairs living room at z 4.20, which is published at `living-room-premium/`). Located by raycast, not
by name: a large open lounge with a curved modular sectional (3DGeom~4, x 1.10..4.17 y 6.10..7.75,
top z 1.38) on a plinth, a second two-seater (3DGeom~1#2, x 1.42..3.74 y 2.79..3.92), a dark-wood low
table on a recessed plinth at (2.54, 5.11), the curved media wall with TV on the west, floor-to-ceiling
glazing to the south, the open-plan dining beyond to the north, and the cantilevered marble staircase
with its under-stair reading nook (barrel chair + planter) to the east. Zone bounds x 0.4..7.7,
y 1.9..8.1, ceiling z 3.90 (west) / 4.05 (east).

## Camera
`LGPanoCam` in `terrace_rebuild_v1.blend` — loc (4.15, 6.45, 2.15) = floor 0.60 + 1.55 m, rotZ 0°.
Chosen by an 8-direction horizontal raycast search on a 0.25 m grid at eye height over the whole
lower-level living zone: **8/8 directions >= 1.20 m clear, minimum 2.97 m, mean 3.86 m** (best of 22
8-of-8 candidates).

## Payload
| file | size |
|---|---|
| `panos/living_ground.jpg` (4096x2048, quality 90) | see live check |
| `panos/depth_rgbd.png` (1024x512, 16-bit RG packed) | see live check |
| `thumbs/terrace_living.jpg` (512x256, in `../tour-nav/thumbs/`) | see live check |

`.jpg` / `.png` are cache-busted with `?v=20260915g` in `tour_v2.html`.

## Depth
`depth_rgbd.png` carries 16-bit depth in R (high byte) + G (low byte), B = sky mask:
`d = (b * 65280 + g * 255) / 65535`, 0..1 with 1.0 = far. `DEPTH_MAX_METERS = 15.0`
in the viewer matches the mapping used to build the field.

The field was produced by raycasting the scene from `LGPanoCam` at 1024x512 (`lg_depth_ray.py`).

**Projection convention (verified, not assumed).** Two emissive marker spheres were placed at
cam+1.5 m east / north / west and rendered (`lg_conv2.py`): east -> u=0.7501, north -> u=0.5000,
west -> u=0.2512. Therefore `u = 0.5 + atan2(dx, dy)/(2*pi)`. The earlier kitchen / bathroom / dining
depth scripts used `bearing = (0.5-u)*2*pi`, which mirrors the field about u = 0.5; this room's field
uses the verified convention. Alignment to the rendered pano is validated by named-pixel raycast
probes (`lg_align_check.py`): table top, table plinth, sofa seat, floor, ceiling, media ledge,
west wall, barrel chair, stair tread, east wall — all PASS.

## Lighting
The zone had **no lights of its own** (`LIGHTS_IN_ZONE = 0`: every existing light sat in the upstairs
living room, the kitchen, the bathroom or the upper hall; `ConsoleLED`/`TVGlow` are at z 4.50-5.65,
i.e. above the ground-floor ceiling), so a per-room lighting layer was added and saved into the blend:
`LG_Down0..3` (ceiling downlights), `LG_Lamp` (warm accent at the media console), `LG_Fill`.
Lights are `visible_camera=False` so no fixture reads in the pano.

## Audit
Raycast defect audit from `LGPanoCam` (`lg_audit.py`, 144x72 equirect sweep, 10 368 rays):
* `wd60` leftover: **`[]`** (the translucent tufted-grid chair defect class is fully swept).
* translucent on furniture: 12 hits — all window glazing (`[Color M00]2`), glazed partition panels and
  stemware; assessed legitimate.
* tufted/weave: 9 hits — all `SofaWeave` on the sofas and the barrel chair, verified opaque solid at
  100% crop (not the wd60 grid defect).
* flush slab on floor: 4 hits — stair plinth (`G-Object.937`), the arch base (`G-archmodel1`), the
  dining pedestal (`G-Object.967`, resting on `G-Object.968`), and **`C-Componente#10`**, a
  1.00 x 1.21 x 0.19 m dark-wood low table whose vertical sides met the floor with no legs or plinth.
  **Fixed in fix round 1**: a recessed plinth `LG_TablePlinth` (inset 0.10 m, z 0.615..0.705, using the
  table's own material) was added and the top lifted +0.09 m so its underside (0.690) is carried by the
  plinth. Re-verified: contact overlap 0.015 m, side rays hit the plinth at z 0.63/0.66/0.70.
* floating objects: all resolved as legitimate (dining chairs with corner legs, dining tableware on the
  table, intentionally cantilevered stair treads, the glass stair balustrade, wall-anchored cladding
  panels and the floating west-wall console ledge `G-ZZZ248` under the media wall).
**2K proof render PASS** at 100% crops, twice (before and after fix round 1), including one full-width
band containing ALL furniture at once: no ghost/translucent furniture, no floating objects, no missing
surfaces, no black holes. **4K ship render QA PASS.**

## VR fallback
Desktop parallax is the current mode. `tour_classic.html` (pannellum, standard pano) kept as the
fallback.
