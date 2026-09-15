# Terrace Parallax Depth Viewer — DINING

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `kitchen-premium/`, `bathroom-premium/` and `living-room-premium/`
(THREE.js equirect + RGBD ray-march parallax).

## Room
Dining, lower-level open plan of the Terrace Residence. Located by raycast, not by name:
floor z 0.60, ceiling z ~4.05, dining table at ~(2.0, 9.5) west of the kitchen open area.
Table = G-Object.966 top (1.32..2.17 x, 8.56..10.76 y, z 1.35..1.39) on a central
**pedestal + plinth base** (G-Object.967/968) with 6 upholstered chairs.

## Camera
`DinPanoCam` in `terrace_rebuild_v1.blend` — loc (2.2, 8.0, 2.15) =
floor + 1.55 m, rotZ 0° (faces north toward the table).
Chosen by an 8-direction horizontal raycast search: **8/8 directions ≥ 1.20 m clear
(min 2.20 m, mean 3.6 m)**.

## Payload
| file | size |
|---|---|
| `panos/dining.jpg` (4096×2048, quality 90) | see live check |
| `panos/depth_rgbd.png` (1024×512, 16-bit RG packed) | see live check |
| `thumbs/dining.jpg` (512×256) | see live check |

`.jpg` / `.png` are cache-busted with `?v=20260915d` in `tour_v2.html`.

## Depth
`depth_rgbd.png` carries 16-bit depth in R (high byte) + G (low byte), B = sky mask:
`d = (b * 65280 + g * 255) / 65535`, 0..1 with 1.0 = far. `DEPTH_MAX_METERS = 15.0`
in the viewer must match the mapping used to build the field.

The field was produced by raycasting the scene from `DinPanoCam` at 1024×512
(`din_depth_ray.py`). Alignment to the rendered pano is validated by named-pixel
raycast probes (`din_align_check.py`): table top, ceiling z 4.05, floor z 0.60,
table corners, tableware, west/north walls — all PASS.

## Lighting
The dining zone was unlit (all scene lights were in the living room / kitchen /
bathroom), so a per-room lighting layer was added and saved into the blend:
`DIN_Down0/1/2/3` (ceiling downlights), `DIN_Pendant`, `DIN_Fill`. Lights are
`visible_camera=False` so no fixture reads in the pano.

## Audit
Raycast defect audit from DinPanoCam: `wd60=[]`, no flush slabs (table has a pedestal),
no floating defects, no ghosts. 2K proof PASS at 100% crops. **4K ship render QA PASS.**

## VR fallback
Desktop parallax is the current mode. `tour_classic.html` (pannellum, standard pano) kept
as the fallback.
