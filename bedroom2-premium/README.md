# Terrace Parallax Depth Viewer — BEDROOM 2 (lower-left upper-level bedroom, manifest id `bedroom_2`)

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `bedroom-premium/`, `masterbedroom-premium/`, `kitchen-premium/`, `bathroom-premium/`,
`dining-premium/`, `livingground-premium/` and `living-room-premium/` (THREE.js equirect + RGBD
ray-march parallax).

## Room
The second of the two near-twin upper-level bedrooms, **upper level** (floor z 4.20, ceiling z 7.80).
Identified by content match against the retired v17 `bedroom_2` pano, not by name: it is the room with
**no** wall-mounted display panel, **no** media console and **no** ottoman on the feature wall, carrying
instead an abstract mural above the bed head (G-Object.125, FrameArt) — the v17 `bedroom` pano shows all
three of those objects and is the already-shipped `bedroom` room (mid-left).
Walls measured by raycast: x ~0.2..3.8 (west slot window G-Object.136, east mural/headboard wall
G-Object.125/126), y ~0.2..5.4 (south slot window G-Object.134, north 900/750 mm louvred entry doors).
Furniture: bed base G-Object.127 with duvet layers 3DGeom~6/7, two floating nightstands G-Object.129/131,
cylindrical pouf C-08.001, wall panel/mirror G-Object.150.

## Assets
* `panos/bedroom_2.jpg` — 4096x2048 JPEG q90, Cycles/CUDA 128 spp, AgX, from `BDPanoCam2` (1.25, 3.70,
  5.75) = floor + 1.55 m. Camera chosen by measured obstacle map (largest empty circle with a >= 1.5 m
  stand-off from the mural/feature wall so the hero artwork reads): real numbers R 0.50, wall 0.55 m,
  furniture 0.50 m, 11 of 24 azimuths >= 1.20 m — the 8/8@1.20 m doctrine is unsatisfiable in a
  3.6 x 5.2 m room whose bed leaves a single aisle.
* `panos/depth_rgbd.png` — 1024x512 16-bit RG-packed RGBD by raycast (15 m max), verified aligned with
  the pano by named-pixel probes and a gradient-correlation test
* hotspots — bearings computed by raycast from `BDPanoCam2` in the same scene state as the render
