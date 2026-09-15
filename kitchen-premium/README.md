# Terrace Parallax Depth Viewer — KITCHEN

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `living-room-premium/` (THREE.js equirect + RGBD ray-march parallax).

## Room
Kitchen, lower level of the Terrace Residence. Located by raycast, not by name:
floor z 0.60, ceiling z 3.95, footprint x 5.5..7.7, y 11..17 m.

## Camera
`KitPanoCam` in `terrace_rebuild_v1.blend` — loc (5.7, 14.5, 2.15) =
floor + 1.55 m, rotZ -111.8° (faces the cabinet wall).
Chosen by an 8-direction horizontal raycast search over the kitchen floor:
**8/8 directions ≥ 1.20 m clear, minimum 1.58 m, mean 2.05 m**.

## Payload
| file | size |
|---|---|
| `panos/kitchen.jpg` (4096×2048, quality 90) | 401 KB |
| `panos/depth_rgbd.png` (1024×512, 16-bit RG packed) | see below |
| `thumbs/kitchen.jpg` (512×256) | 15 KB |

`.jpg` / `.png` are cache-busted with `?v=20260915k` in `tour_v2.html`.

## Depth
`depth_rgbd.png` carries 16-bit depth in R (high byte) + G (low byte), B = sky mask:
`d = (b * 65280 + g * 255) / 65535`, 0..1 with 1.0 = far. `DEPTH_MAX_METERS = 15.0`
in the viewer must match the mapping used to build the field.

The field was produced by raycasting the scene from `KitPanoCam` at 1024×512
(`kit_depth_ray.py`) — the compositor Z-pass route is not usable on Blender 5.2
(no `OPEN_EXR_MULTILAYER` image format; the node-group route wrote a flat-zero EXR).
Validation: 0 NaNs, range 0.07..1.00, 2806 distinct values, mean 0.140, sky 0.015 %
— `DEPTH_PASS`.

## Lighting
The kitchen was unlit (all 21 scene lights were in the living room / upper level), so a
per-room lighting layer was added and saved into the blend: `KIT_Down0/1/2` (ceiling
downlights), `KIT_Strip0/1/2` (under-cabinet), `KIT_Fill`. Lights are `visible_camera=False`
so no fixture reads in the pano.

## Material fixes applied to the room (swept, not per-instance)
1. **Round 1** — 4 countertop / shelf glass containers were carrying a SketchUp placeholder
   material (alpha 0.10, zero transmission) and rendered as ghost outlines. Reassigned to
   `KIT_GlassProp` (transmission 1.0, IOR 1.45, alpha 1.0). Leftover users of the class: `[]`.
2. **Round 2** — a denser raycast sweep (41 472 rays) found 5 more free-standing translucent
   props on the worktop (a 0.39-alpha oil bottle, a small glass, three counter containers).
   Same fix; leftover users of the class: `[]`.

`wd60` leftover list: `[]`. Flush-slab defects: none (the only floor-level slabs are the
cabinet plinth / toe-kick, which is the support for the run). Floating objects: none
(0 meshes with every neighbour > 5 cm away).

## VR fallback
Desktop parallax is the current mode. `tour_classic.html` (pannellum, standard pano) kept
as the fallback.

## Not yet wired
The room is **not** listed in `tour-nav/manifest.json` and has no doorway hotspot — both of
those live in published pages that this change was scoped not to touch. Adding the kitchen
to the room drawer is a one-entry follow-up for the runtime lane.
