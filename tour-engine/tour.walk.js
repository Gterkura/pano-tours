// tour-engine/tour.walk.js — multi-room 360 viewer with RGBD depth parallax + walk-parallax.
// Phase 2.2 walk controls:
//   Mobile: DOUBLE-TAP-AND-HOLD to walk forward in gaze direction; release to stop. No UI.
//   Desktop: WASD / arrow keys.
// v3 fixes: (a) iOS Safari double-tap-zoom swallowing the hold -> touch-action:none +
//   non-passive touch handlers; (b) depth-edge distortion -> edge-aware shift damping.
import * as THREE from 'three';

// ---------------------------------------------------------------- constants
const FOV_DEFAULT = 110.0, FOV_MIN = 60.0, FOV_MAX = 140.0;
const PITCH_LIMIT = 1.28;
const DRAG_YAW = 0.0032;
const INERTIA_TAU = 0.38;
const AUTOROTATE_DELAY = 6.0, AUTOROTATE_SPEED = 8.0;
const TRANSITION_S = 0.8;
const DEPTH_MAX_METERS = 15.0;
const PARALLAX_X = 0.22, PARALLAX_Y = 0.13;
const VERSION = 'nav-2-walk2';
// walk-parallax
const WALK_SPEED = 1.1;                // m/s
const WALK_SMOOTH = 8.0;
const WALK_DEFAULT_CLAMP = 1.5;
const DBLTAP_MS = 320;
const DBLTAP_MOVE_PX = 18;

// ---------------------------------------------------------------- boot
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const loader = new THREE.TextureLoader();
const farPixel = (() => { const t = new THREE.DataTexture(new Uint8Array([255,255,255,255]), 1, 1); t.needsUpdate = true; return t; })();

const uniforms = {
  uPanoA: { value: farPixel }, uPanoB: { value: farPixel },
  uDepthA: { value: farPixel }, uDepthB: { value: farPixel },
  uMix: { value: 0 },
  uParallax: { value: new THREE.Vector2(0, 0) },
  uYaw: { value: 0.0 }, uPitch: { value: 0.0 },
  uFov: { value: FOV_DEFAULT }, uAspect: { value: innerWidth / innerHeight },
  uFwd: { value: new THREE.Vector3(0, 0, -1) },
  uRight: { value: new THREE.Vector3(1, 0, 0) },
  uUp: { value: new THREE.Vector3(0, 1, 0) },
  uDepthMax: { value: DEPTH_MAX_METERS },
  uWalk: { value: new THREE.Vector2(0, 0) },
};

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPanoA, uPanoB, uDepthA, uDepthB;
uniform float uMix;
uniform vec2 uParallax;
uniform float uYaw, uPitch, uFov, uAspect, uDepthMax;
uniform vec3 uFwd, uRight, uUp;
uniform vec2 uWalk;

float decodeDepth(sampler2D tex, vec2 uv){
  vec4 t = texture2D(tex, uv);
  return (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0;
}
vec2 panoUvFor(vec3 dir){
  float u = 0.5 - atan(dir.x, dir.z) / 6.28318530718;
  float v = 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265;
  return vec2(u, v);
}
vec3 sampleSide(sampler2D pano, sampler2D depth, vec3 dir){
  vec2 baseUv = panoUvFor(dir);
  float sceneD = decodeDepth(depth, baseUv);
  float proximity = 1.0 - sceneD;
  float cy = cos(uYaw), sy = sin(uYaw);
  vec2 w = vec2( uWalk.x *  cy + uWalk.y * sy,
                 -uWalk.x * sy + uWalk.y * cy );

  // --- edge-aware shift (v3): damp the walk component near depth discontinuities.
  // Probe depth at +-2px around baseUv; a large spread = depth edge -> soften shift.
  vec2 px = vec2(2.0 / 1024.0, 2.0 / 512.0);
  float dL = decodeDepth(depth, baseUv - vec2(px.x, 0.0));
  float dR = decodeDepth(depth, baseUv + vec2(px.x, 0.0));
  float dU = decodeDepth(depth, baseUv - vec2(0.0, px.y));
  float dD = decodeDepth(depth, baseUv + vec2(0.0, px.y));
  float spread = max(max(abs(dR - dL), abs(dD - dU)), 0.0);
  float edge = 1.0 - smoothstep(0.01, 0.06, spread);   // 1 = flat area, 0 = edge
  // also scale total walk gain with proximity (near objects shift more) but cap it
  vec2 total = uParallax + w * 2.2 * edge;             // was 6.0, no damping
  vec2 shift = total * proximity * 0.04;
  vec2 uv = baseUv - shift;
  float d2 = decodeDepth(depth, uv);
  uv = baseUv - total * (1.0 - d2) * 0.04;
  return texture2D(pano, uv).rgb;
}
void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  float tanF = tan(radians(uFov) * 0.5);
  vec3 dir = normalize(uFwd + uRight * (ndc.x * tanF * uAspect) + uUp * (ndc.y * tanF));
  vec3 col = mix(sampleSide(uPanoA, uDepthA, dir), sampleSide(uPanoB, uDepthB, dir), uMix);
  gl_FragColor = vec4(col, 1.0);
}`;

const mat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: FRAG,
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

// ---------------------------------------------------------------- state
let rooms = [], byId = {}, current = null, pendingId = null;
let dragging = false, lastX = 0, lastY = 0;
let targetYaw = 0, targetPitch = 0, targetPx = 0, targetPy = 0;
let velYaw = 0, velPitch = 0, lastMoveT = 0, lastInputT = performance.now();
let switching = false, mixStart = 0, switchToken = 0;
const keys = {};
const walkPos = new THREE.Vector2(0, 0);
const walkTarget = new THREE.Vector2(0, 0);
let walkClamp = WALK_DEFAULT_CLAMP;
let walking = false;
let lastTapT = 0, lastTapX = 0, lastTapY = 0, tapArmed = false;

const el = renderer.domElement;
const hintEl = document.getElementById('hint');

// v3: kill browser gesture hijacking on the canvas (iOS double-tap zoom, long-press menu)
el.style.touchAction = 'none';
el.style.webkitUserSelect = 'none';
el.style.userSelect = 'none';
el.addEventListener('contextmenu', e => e.preventDefault());
// double-tap-zoom kill switch at document level (iOS <13 ignores touch-action on some versions)
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

function markInput() { lastInputT = performance.now(); }
function down(x, y) { dragging = true; lastX = x; lastY = y; velYaw = velPitch = 0; lastMoveT = markInput(); hintEl && (hintEl.style.opacity = 0); }
function move(x, y) {
  markInput();
  if (!dragging) return;
  const now = performance.now(), dt = Math.max((now - lastMoveT) / 1000, 0.001);
  const dx = x - lastX, dy = y - lastY; lastX = x; lastY = y; lastMoveT = now;
  const dYaw = -dx * DRAG_YAW, dPitch = dy * 0.0016;
  targetYaw += dYaw;
  targetPitch = THREE.MathUtils.clamp(targetPitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT);
  targetPy = THREE.MathUtils.clamp(targetPy + dy * 0.0004, -PARALLAX_Y, PARALLAX_Y);
  velYaw = velYaw * 0.6 + (dYaw / dt) * 0.4;
  velPitch = velPitch * 0.6 + (dPitch / dt) * 0.4;
}
function up() { dragging = false; walking = false; }

// v3: non-passive touchstart on the canvas so preventDefault actually stops iOS
// double-tap-zoom synthesis; pointer events remain for the interaction logic.
el.addEventListener('touchstart', e => {
  if (e.touches.length === 1) e.preventDefault();       // stop iOS double-tap zoom synthesis
}, { passive: false });

el.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') {
    const now = performance.now();
    const near = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < DBLTAP_MOVE_PX;
    if (tapArmed && (now - lastTapT) < DBLTAP_MS && near) {
      walking = true;                    // hold = walk forward in gaze direction
      tapArmed = false;
      markInput();
      return;                             // this touch is the walk hold, NOT a look-drag
    }
    tapArmed = true;
    lastTapT = now; lastTapX = e.clientX; lastTapY = e.clientY;
  }
  down(e.clientX, e.clientY);
});
addEventListener('pointermove', e => move(e.clientX, e.clientY));
addEventListener('pointerup', up);
addEventListener('pointercancel', up);

addEventListener('mousemove', e => {
  if (dragging || e.pointerType === 'touch') return;
  markInput();
  targetPx = (e.clientX / innerWidth - .5) * 2 * PARALLAX_X;
  targetPy = (e.clientY / innerHeight - .5) * 2 * PARALLAX_Y;
});
let pinch0 = 0, fov0 = FOV_DEFAULT;
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
let pinchActive = false;

function dist(e) { const a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
el.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    if (!pinchActive) { pinchActive = true; pinch0 = dist(e); fov0 = uniforms.uFov.value; }
    markInput();
    uniforms.uFov.value = THREE.MathUtils.clamp(fov0 * pinch0 / dist(e), FOV_MIN, FOV_MAX);
    e.preventDefault();
  }
}, { passive: false });
el.addEventListener('touchend', e => { if (e.touches.length < 2) pinchActive = false; });

addEventListener('wheel', e => { markInput(); uniforms.uFov.value = THREE.MathUtils.clamp(uniforms.uFov.value + e.deltaY * 0.02, FOV_MIN, FOV_MAX); });

// keyboard walk (desktop)
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ('wasd'.includes(k) || k.startsWith('arrow')) { keys[k] = true; markInput(); e.preventDefault(); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function walkInput() {
  let f = 0, s = 0;
  if (keys['w'] || keys['arrowup']) f += 1;
  if (keys['s'] || keys['arrowdown']) f -= 1;
  if (keys['a'] || keys['arrowleft']) s -= 1;
  if (keys['d'] || keys['arrowright']) s += 1;
  if (f || s) {
    const n = Math.hypot(f, s);
    return { f: f / n, s: s / n };
  }
  if (walking) return { f: 1, s: 0 };
  return { f: 0, s: 0 };
}

// ---------------------------------------------------------------- rooms + transitions
async function switchTo(id, keepView = true) {
  const room = byId[id];
  if (!room || (current && current.id === id)) return;
  const myToken = ++switchToken;
  pendingId = id;
  const loadWithTimeout = (url, ms = 12000) => Promise.race([
    loader.loadAsync(url),
    new Promise((_, rej) => setTimeout(() => rej(new Error('load timeout ' + url)), ms))
  ]);
  let pano = null;
  try { pano = await loadWithTimeout(room.pano); } catch (e) { console.error('pano load failed', room.pano, e); pano = null; }
  if (!pano) { pendingId = null; console.error('switchTo aborted: no pano for', id); return; }
  if (myToken !== switchToken) return;
  uniforms.uPanoA.value = uniforms.uPanoB.value;
  uniforms.uDepthA.value = uniforms.uDepthB.value;
  uniforms.uPanoB.value = pano;
  uniforms.uPanoB.value.colorSpace = THREE.SRGBColorSpace;
  uniforms.uDepthB.value = depthCache[id] || farPixel;
  uniforms.uDepthB.value.minFilter = uniforms.uDepthB.value.magFilter = THREE.LinearFilter;
  uniforms.uMix.value = 0;
  mixStart = performance.now();
  switching = true;
  if (!keepView) { targetYaw = 0; targetPitch = 0; }
  current = room; pendingId = null;
  walkTarget.set(0, 0); walkPos.set(0, 0);
  walking = false;
  walkClamp = (room && room.walk_clamp) ? room.walk_clamp : WALK_DEFAULT_CLAMP;
  buildHotspots(room);
  if (window.__onRoomChanged) window.__onRoomChanged(room);
  loadWithTimeout(room.depth, 15000).then(d => {
    if (d) { d.minFilter = d.magFilter = THREE.LinearFilter; depthCache[id] = d;
      if (current === room) uniforms.uDepthB.value = d; }
  }).catch(()=>{});
  prefetchNeighbors(room);
}
const depthCache = {}, panoCache = new Set();
async function prefetchNeighbors(room) {
  (room.hotspots || []).forEach(h => {
    if (!h.to) return;
    const nb = byId[h.to]; if (!nb) return;
    if (!panoCache.has(nb.pano)) {
      panoCache.add(nb.pano);
      loader.loadAsync(nb.pano).catch(()=>{});
    }
    if (nb.depth && !depthCache[nb.id]) {
      loader.loadAsync(nb.depth).then(d => { d.minFilter = d.magFilter = THREE.LinearFilter; depthCache[nb.id] = d; }).catch(()=>{});
    }
  });
}
function finishTransition() {
  uniforms.uPanoA.value = uniforms.uPanoB.value;
  uniforms.uDepthA.value = uniforms.uDepthB.value;
  uniforms.uMix.value = 0;
  switching = false;
}

// ---------------------------------------------------------------- hotspots
const hsLayer = document.getElementById('hotspots');
let hotspotEls = [];
function buildHotspots(room) {
  hotspotEls.forEach(h => h.el.remove()); hotspotEls = [];
  (room.hotspots || []).forEach(h => {
    // Room links (h.to) render as FLOOR-PINNED markers: projected to the floor plane at
    // the direction the hotspot yaw points, at the room's walk distance. Tapping glides
    // the camera toward that yaw (in-room glide) or crossfades to the target room.
    // Feature markers (no h.to) stay as classic floating icons that aim the view.
    const d = document.createElement('div');
    const isRoomLink = !!h.to;
    d.className = isRoomLink ? 'hs hs-floor' : 'hs';
    d.innerHTML = `<div class="dot">${h.icon || '➜'}</div><div class="lbl">${h.label || ''}</div>`;
    d.addEventListener('click', ev => {
      ev.stopPropagation(); markInput();
      if (h.to) { goToRoom(h.to); }          // floor marker: glide + transition
      else { aimTo(h.yaw, h.pitch); }
    });
    hsLayer.appendChild(d);
    // floor markers get floorPitch instead of hotspot pitch
    hotspotEls.push({ el: d, ...h });
  });
}
// best-of-both room navigation:
//  1) GLIDE phase: rotate view toward the target room's direction, drift walkTarget a
//     little forward (inside clamp — no distortion since we stay in the depth field).
//  2) CROSSFADE: the standard 0.8s room transition completes the move.
let gliding = false, glideStart = 0, glideYawFrom = 0, glideYawTo = 0, glideTarget = null;
const GLIDE_MS = 900;
function goToRoom(id) {
  const room = byId[id];
  if (!room || gliding || switching) return;
  // find the hotspot yaw pointing to that room
  const hs = (current.hotspots || []).find(h => h.to === id);
  const targetYawAbs = hs ? hs.yaw : targetYaw;
  gliding = true; glideStart = performance.now();
  glideYawFrom = uniforms.uYaw.value;
  let dy = targetYawAbs - glideYawFrom;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  glideYawTo = glideYawFrom + dy;
  glideTarget = id;
  // NO forward drift (Philip: drift-during-turn causes the distortion warp).
  // Tap = clean turn only, then the 0.8s crossfade moves the room.
}
function tickGlide() {
  if (!gliding) return;
  const t = Math.min((performance.now() - glideStart) / GLIDE_MS, 1);
  const e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;   // easeInOutQuad
  targetYaw = glideYawFrom + (glideYawTo - glideYawFrom) * e;
  uniforms.uYaw.value = targetYaw;   // glide drives the view directly (snappy, intentional)
  if (t >= 1) {
    gliding = false;
    switchTo(glideTarget, true);      // crossfade completes the room move; keeps view
    glideTarget = null;
  }
}
function aimTo(yaw, pitch) {
  let d = yaw - uniforms.uYaw.value;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  targetYaw = uniforms.uYaw.value + d;
  targetPitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  velYaw = velPitch = 0;
}
// ---- TRUE floor-pinning (v2): markers live at 3D world positions on the room floor.
// Room camera calibration (from fix7): position, rotZ, floor Z. Loaded from room_cams.json.
let roomCams = {};
fetch(new URL('../tour-nav/room_cams.json?cb=' + Date.now(), import.meta.url)).then(r => r.json()).then(j => { roomCams = j; }).catch(()=>{});
// per-room yaw offset: the pano texture's yaw-0 direction vs world -Z, from the render rotZ.
// Pano rendering convention (bth_depth_ray): world dir az measured from rotZ; the equirect
// u=0.5 column looks along camera rotZ direction. In the viewer, yaw=0 shows u=0.5 center,
// so world bearing of view center = camRotZ, and world bearing at viewer yaw Y = camRotZ - Y.
function markerWorldPos(h) {
  const rc = roomCams[current && current.id];
  if (!rc) return null;   // no calibration -> caller hides marker (never falls back to floating)
  // distance: use hotspot pitch if it encodes one, else default 2.6m along the marker's yaw
  const dist = (h.floor_dist != null) ? h.floor_dist : 2.6;
  // marker bearing in world: viewer yaw of the hotspot relative to room yaw origin
  // hotspot h.yaw is the VIEWER yaw where the marker is centered at walkPos=0,
  // i.e. world bearing = rc.rotz - h.yaw (deg)
  const bearing = (rc.rotz - THREE.MathUtils.radToDeg(h.yaw)) * Math.PI / 180;
  // walk offset shifts the camera in world; marker is fixed in world:
  const camx = rc.cam[0] + walkPosWorld().x;
  const camy = rc.cam[1] + walkPosWorld().y;
  return {
    x: camx + Math.cos(bearing) * dist,
    y: camy + Math.sin(bearing) * dist,
    z: rc.floor,                       // on the floor
    camz: rc.cam[2],
    camx, camy, bearing,
  };
}
// viewer walk offset (x=right,y=fwd at yaw) to world dx,dy using room rotz frame:
function walkPosWorld() {
  const rc = roomCams[current && current.id];
  if (!rc) return { x: 0, y: 0 };
  // viewer yaw->world bearing: bearing = rotz - yawDeg. walkTarget was built view-relative;
  // convert: world displacement = R(-rotz) applied to (walkPos.y fwd along -Z view)... 
  // Simplest consistent model: walk +x viewer = world +Y at rotz=0... derive from same frame
  // used to place markers so both agree: viewer forward (yaw Y) has world bearing (rotz - Ydeg).
  const yawDeg = THREE.MathUtils.radToDeg(uniforms.uYaw.value);
  const bF = (rc.rotz - yawDeg) * Math.PI / 180;         // forward bearing
  const bR = bF - Math.PI / 2;                            // right bearing
  return {
    x: walkPos.y * Math.cos(bF) + walkPos.x * Math.cos(bR),
    y: walkPos.y * Math.sin(bF) + walkPos.x * Math.sin(bR),
  };
}
function projectHotspots() {
  hotspotEls.forEach(h => {
    if (h.to && h.floorPinned !== false) {
      // ---- FLOOR-PINNED room marker.
      // Provably-correct route: reuse the known-good hotspot screen projection with a
      // pitch computed from true geometry: the marker sits on the floor at floor_dist,
      // eye is eye_h above floor => screen pitch = -atan2(eye_h, floor_dist).
      // World-anchoring across walk offsets: shift yaw by the viewer's walk so the
      // marker stays fixed in the world as you drift (small offsets — linear approx).
      const rc = roomCams[current && current.id];
      if (!rc) { h.el.style.display = 'none'; return; }
      const eyeH = rc.cam[2] - rc.floor;              // eye height above floor
      const dist = h.floor_dist != null ? h.floor_dist : 2.6;
      const basePitch = -Math.atan2(eyeH, dist);      // e.g. -0.88 rad at 1.2m
      // walk parallax: as the viewer moves forward w (m) toward the marker, the marker's
      // angular position steepens: pitch' = -atan2(eyeH, dist - w_parallel)
      const yawRad = h.yaw;
      let dy = yawRad - uniforms.uYaw.value;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const fwd = Math.cos(dy) * walkPos.y;           // viewer forward component toward marker
      const strafe = Math.sin(dy) * walkPos.x;
      const eff = Math.max(0.4, dist - fwd);          // distance remaining to marker
      const pitch = -Math.atan2(eyeH, Math.hypot(eff, strafe));
      // screen projection (same tangent math as feature branch)
      const dx = Math.tan(dy), dyp = Math.tan(pitch - uniforms.uPitch.value);
      const tanF = Math.tan(THREE.MathUtils.degToRad(uniforms.uFov.value) / 2);
      const sx = (dx / (tanF * uniforms.uAspect.value) + 1) / 2;
      const sy = (1 - dyp / tanF) / 2;
      const vis = sx > 0.02 && sx < 0.98 && sy > 0.02 && sy < 0.98 && Math.abs(dy) < 1.2;
      h.el.style.display = vis ? 'block' : 'none';
      if (vis) {
        const s = THREE.MathUtils.clamp(2.2 / dist, 0.6, 1.5);
        h.el.style.left = (sx * innerWidth) + 'px';
        h.el.style.top = (sy * innerHeight) + 'px';
        h.el.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;
      }
    } else {
      // floating feature markers: classic projection
      let dy = h.yaw - uniforms.uYaw.value;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const dx = Math.tan(dy), dyp = Math.tan(h.pitch - uniforms.uPitch.value);
      const tanF = Math.tan(THREE.MathUtils.degToRad(uniforms.uFov.value) / 2);
      const sx = (dx / (tanF * uniforms.uAspect.value) + 1) / 2;
      const sy = (1 - dyp / tanF) / 2;
      const vis = sx > 0.02 && sx < 0.98 && sy > 0.02 && sy < 0.98;
      h.el.style.display = vis ? 'block' : 'none';
      if (vis) { h.el.style.left = (sx * innerWidth) + 'px'; h.el.style.top = (sy * innerHeight) + 'px'; }
    }
  });
}

// ---------------------------------------------------------------- drawer
function buildDrawer() {
  const wrap = document.getElementById('drawer');
  document.getElementById('drawerBtn').addEventListener('click', () => wrap.classList.toggle('open'));
  wrap.innerHTML = rooms.map(r => `<div class="card" data-id="${r.id}">
      <img src="${r.thumb || r.pano}" alt=""><span>${r.name}</span></div>`).join('');
  wrap.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
    switchTo(c.dataset.id); wrap.classList.remove('open');
  }));
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let frameNo = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (switching) {
    const t = Math.min((performance.now() - mixStart) / (TRANSITION_S * 1000), 1);
    uniforms.uMix.value = t;
    if (t >= 1) finishTransition();
  }
  if (!dragging && (Math.abs(velYaw) > 1e-4 || Math.abs(velPitch) > 1e-4)) {
    const decay = Math.exp(-dt / INERTIA_TAU);
    targetYaw += velYaw * dt;
    targetPitch = THREE.MathUtils.clamp(targetPitch + velPitch * dt, -PITCH_LIMIT, PITCH_LIMIT);
    velYaw *= decay; velPitch *= decay;
  }
  if (!dragging && (performance.now() - lastInputT) / 1000 > AUTOROTATE_DELAY) {
    targetYaw += (AUTOROTATE_SPEED * Math.PI / 180) * dt;
  }
  targetPitch = THREE.MathUtils.clamp(targetPitch, -PITCH_LIMIT, PITCH_LIMIT);
  tickGlide();
  // ---- walk integration
  const wi = walkInput();
  if (wi.f || wi.s) {
    markInput();
    const yaw = targetYaw;
    const fwdX = -Math.sin(yaw), fwdY = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightY = -Math.sin(yaw);
    walkTarget.x += (rightX * wi.s + fwdX * wi.f) * WALK_SPEED * dt;
    walkTarget.y += (rightY * wi.s + fwdY * wi.f) * WALK_SPEED * dt;
    const m = Math.hypot(walkTarget.x, walkTarget.y);
    if (m > walkClamp) { walkTarget.x *= walkClamp / m; walkTarget.y *= walkClamp / m; }
  }
  const kw = 1 - Math.exp(-WALK_SMOOTH * dt);
  walkPos.x += (walkTarget.x - walkPos.x) * kw;
  walkPos.y += (walkTarget.y - walkPos.y) * kw;
  uniforms.uWalk.value.copy(walkPos);
  // ----
  const k = 1 - Math.pow(0.0001, dt);
  uniforms.uYaw.value += (targetYaw - uniforms.uYaw.value) * k;
  uniforms.uPitch.value += (targetPitch - uniforms.uPitch.value) * k;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(uniforms.uPitch.value, uniforms.uYaw.value, 0, 'YXZ'));
  uniforms.uFwd.value.set(0, 0, -1).applyQuaternion(q);
  uniforms.uRight.value.set(1, 0, 0).applyQuaternion(q);
  uniforms.uUp.value.set(0, 1, 0).applyQuaternion(q);
  uniforms.uParallax.value.set(targetPx, targetPy);
  projectHotspots();
  if (window.__mapUpdate && (frameNo++ & 3) === 0) {
    window.__mapUpdate(current ? current.plan_xy || null : null, uniforms.uYaw.value, current ? current.id : null);
  }
  renderer.render(scene, orthoCam);
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  uniforms.uAspect.value = innerWidth / innerHeight;
});

// ---------------------------------------------------------------- init
(async function init() {
  const manifestUrl = (document.body.dataset.manifest) || 'manifest.json';
  const man = await (await fetch(manifestUrl + (manifestUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now())).json();
  rooms = man.rooms || []; rooms.forEach(r => byId[r.id] = r);
  document.getElementById('brand').innerHTML = `<h1>${man.title || ''}</h1><p>${man.subtitle || ''}</p>`;
  buildDrawer();
  await switchTo(man.start || rooms[0].id, false);
  uniforms.uPanoA.value = uniforms.uPanoB.value;
  uniforms.uDepthA.value = uniforms.uDepthB.value;
  uniforms.uMix.value = 0; switching = false;
  tick();
})();

// ---------------------------------------------------------------- QA hook
window.__viewer = {
  version: VERSION,
  get room() { return current && current.id; },
  get rooms() { return rooms.map(r => r.id); },
  get switching() { return switching; },
  get mix() { return uniforms.uMix.value; },
  get fov() { return uniforms.uFov.value; }, set fov(v) { uniforms.uFov.value = THREE.MathUtils.clamp(v, FOV_MIN, FOV_MAX); },
  get yaw() { return targetYaw; }, get pitch() { return targetPitch; },
  get walk() { return { x: walkPos.x, y: walkPos.y, clamp: walkClamp, walking }; },
  walkTo(x, y) { walkTarget.set(THREE.MathUtils.clamp(x, -walkClamp, walkClamp), THREE.MathUtils.clamp(y, -walkClamp, walkClamp)); },
  hotspots() { return hotspotEls.map(h => ({ label: h.label, yaw: h.yaw, to: h.to || null })); },
  aim(y, p) { aimTo(y, p); },
  go(id, keepView = true) { return switchTo(id, keepView); },
  limits: { fov: [FOV_MIN, FOV_MAX], pitch: PITCH_LIMIT, tau: INERTIA_TAU, autorotate: AUTOROTATE_SPEED, transition: TRANSITION_S, walkClampDefault: WALK_DEFAULT_CLAMP },
};
