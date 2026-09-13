# Terrace Parallax Depth Viewer

Premium 2.5D depth-parallax panorama viewer — UsheredWorlds proprietary.

## Pipeline
1. `setup_pano_render.py` (Blender 5.2 headless): renders RGB equirect pano
   + 32-bit Z-depth EXR in one run, equirect camera at eye level, AgX High
   Contrast, Z pass → MapRange(0–15 m → 0–1) → EXR output.
2. `validate_depth.py`: pass/fail probe (NaNs, range, flat-zero, variation,
   sky fraction). Nothing ships to the web side until DEPTH_PASS.
3. RGBD packer: depth EXR → 16-bit RG-packed PNG (1024×512) + sky mask in B.

## Viewer (tour.html)
- Three.js fragment-shader parallax: ray-origin offset scaled by depth
  proximity (NOT sphere-vertex displacement — no wavy door frames).
- **Gestures (Option 1):** horizontal drag = rotate 360°; vertical drag =
  pitch + depth parallax; mouse hover = subtle parallax; pinch/wheel = zoom.
- 3D-anchored hotspots project from yaw/pitch and hide off-view.

## Parallax tuning
- `PARALLAX_X` / `PARALLAX_Y` (viewer JS): max head-shift amplitude.
- Shader shift factor `0.06`: uv offset per proximity unit. Increase for
  stronger 3D pop; decrease if edges smear.
- `DEPTH_MAX_METERS = 15.0` must match the Blender MapRange 'From Max'.

## Payload
- pano RGB: 129 KB · depth RGBD: 10 KB → **0.14 MB per scene** (budget 8 MB).

## VR fallback
- Desktop parallax is the current mode. WebXR per-eye parallax planned as
  the Quest path; `tour_classic.html` (standard pano) kept as fallback.
