# Terrace Parallax Depth Viewer — BATHROOM

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `kitchen-premium/` and `living-room-premium/` (THREE.js equirect + RGBD ray-march parallax).

## Room
Bathroom (en-suite), upper level of the Terrace Residence. Located by raycast, not by name:
floor z 4.20, ceiling z 7.80, footprint x 1.3..3.5, y 11.6..14.4 m. The north bathroom
(y 14.8..17.1) is a separate en-suite, not part of this pano.

## Camera
`BthPanoCam` in `terrace_rebuild_v1.blend` — loc (2.5, 13.0, 5.75) =
floor + 1.55 m, rotZ -64° (faces the vanity & mirror wall).
Chosen by an 8-direction horizontal raycast search over the bathroom floor:
**7/8 directions ≥ 1.2 m clear (min 1.03 m, mean ~1.45 m)** — a small en-suite,
so the clearance is naturally tighter than the kitchen's.

## Payload
| file | size |
|---|---|
| `panos/bathroom.jpg` (4096×2048, quality 90) | see live check |
| `panos/depth_rgbd.png` (1024×512, 16-bit RG packed) | see live check |
| `thumbs/bathroom.jpg` (512×256) | see live check |

`.jpg` / `.png` are cache-busted with `?v=20260915b` in `tour_v2.html`.

## Depth
`depth_rgbd.png` carries 16-bit depth in R (high byte) + G (low byte), B = sky mask:
`d = (b * 65280 + g * 255) / 65535`, 0..1 with 1.0 = far. `DEPTH_MAX_METERS = 15.0`
in the viewer must match the mapping used to build the field.

The field was produced by raycasting the scene from `BthPanoCam` at 1024×512
(`bth_depth_ray.py`) — the compositor Z-pass route is not usable on Blender 5.2.
Alignment to the rendered pano is validated by named-pixel raycast probes
(`bth_mapcheck.py`): vanity/mirror → the vanity, shower → shower glass, ceiling z 7.80,
floor z 4.20.

## Lighting
The bathroom was unlit (all scene lights were in the living room / kitchen / upper
corridor), so a per-room lighting layer was added and saved into the blend:
`BTH_Down0/1` (ceiling downlights), `BTH_Vanity` (over the mirror), `BTH_Shower`,
`BTH_Fill`. Lights are `visible_camera=False` so no fixture reads in the pano.

## Material / geometry audit (raycast from BthPanoCam, 10 368 rays)
| defect class | result | evidence |
|---|---|---|
| `wd60`-class material | **none** | `WD60_LEFTOVER = []` |
| tufted / weave-class material | **none** (0 objects) | D1b_COUNT 0 |
| translucent material on furniture | 2 tiny glass props, both **legitimate** | see note |
| flush slab on floor with no supports | **none** | D2_COUNT 0 |
| floating / isolated object | 21 flagged, all **legitimate** wall-mounts | see note |

**Translucent note.** Two in-frame glass items carry alpha-0.16 `[Translucent_Glass_Gray]3`
— the model's glass convention (same as the kitchen). Verified at 100% in the 2K proof:
they render as clean surfaces, no ghost outlines, no see-through. The frosted shower
screens (`[Translucent_Glass_Gray]1`) are intentional. Cleared, not fixed.

**Floating note.** The 21 D3 hits are all deliberate wall-mounted / stacked fixtures:
the floating vanity cabinet, the mirror, wall-mount faucets, the wall shelves, the
shower-screen header. The strict test (every neighbour > 5 cm away) flags these by
design; none is a loose floating defect.

## 2K proof QA (100% crops)
`bathroom_2k.png` 2048×1024, 128 spp, CUDA, AgX, 68 s. 100% crops reviewed:
vanity/sink reads solid (vessel basin on counter, supported by wood carcass), mirror
reads as a reflective panel, shower glass renders properly, toilet wall-hung and
correct, no ghosting / missing surfaces / z-fighting / floating parts. **PASS.**

## VR fallback
Desktop parallax is the current mode. `tour_classic.html` (pannellum, standard pano) kept
as the fallback.
