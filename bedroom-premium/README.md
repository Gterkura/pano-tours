# Terrace Parallax Depth Viewer — BEDROOM (second bedroom)

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.
Same engine as `masterbedroom-premium/`, `kitchen-premium/`, `bathroom-premium/`, `dining-premium/`,
`livingground-premium/` and `living-room-premium/` (THREE.js equirect + RGBD ray-march parallax).

## Room
Second bedroom of the Terrace Residence, **upper level** (floor z 4.20, ceiling z 7.80). Located and
identified entirely by raycast (never by name): walls at x -0.85 (west, glazed curtain wall x -0.85 = G-Object.098/099),
x 3.30 (east — media wall, mirror `G-Object.142`, console `_G-Object.144`), y 6.18 (south — slot window `G-Object.107`)
and y 11.06 (north — 750 mm louvred entry door, 900 mm louvred side door at x 3.36).
The two 2.7 x 2.2 m upper rooms (mid-left x -0.85..3.30 / lower-left x 0.34..3.76) are near-twins; this one is the
room matching the retired v17 `bedroom` pano (white wall-mounted display panel + dark floating media console +
cylindrical ottoman + two-tone wardrobe with a dark open shelf tower + slot windows), confirmed by
diagnostic render comparison — the lower-left twin has no TV, no console and no ottoman.

## Assets
* `panos/bedroom.jpg` — 4096x2048 JPEG q90, Cycles/CUDA 128 spp, AgX, from `BDPanoCam` (2.60, 9.40, 5.75)
* `panos/depth_rgbd.png` — 1024x512 16-bit RG-packed RGBD by raycast (MapRange equivalent: 15 m max), verified
  aligned with the pano by 14 named-pixel probes and a gradient-correlation test
* hotspots — 12, bearings computed by raycast from `BDPanoCam` in the same scene state as the render
