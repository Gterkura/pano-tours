// tour-engine/tour.js — multi-room 360 viewer with RGBD depth parallax.
// Verified-against-reference control feel (2026-09-14):
//   inertial drag (tau 0.38s), FOV 110 default (60..140), pitch limit ~73deg,
//   autorotate 8 deg/s after 6s idle, 0.8s crossfade scene transitions with view-merge.
// One writer per file. QA hook: window.__viewer
import * as THREE from 'three';

// ---------------------------------------------------------------- constants
const FOV_DEFAULT = 110.0, FOV_MIN = 60.0, FOV_MAX = 140.0;
const PITCH_LIMIT = 1.28;              // ~73deg, keeps equirect poles out of frame
const DRAG_YAW = 0.0032;
const INERTIA_TAU = 0.38;
const AUTOROTATE_DELAY = 6.0, AUTOROTATE_SPEED = 8.0;
const TRANSITION_S = 0.8;              // matches loadscene(...,MERGE,BLEND(0.8))
const DEPTH_MAX_METERS = 15.0;
const PARALLAX_X = 0.22, PARALLAX_Y = 0.13;
const VERSION = 'nav-1';

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
};

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPanoA, uPanoB, uDepthA, uDepthB;
uniform float uMix, uParallax_tmp;
uniform vec2 uParallax;
uniform float uYaw, uPitch, uFov, uAspect, uDepthMax;
uniform vec3 uFwd, uRight, uUp;

float decodeDepth(sampler2D tex, vec2 uv){
  vec4 t = texture2D(tex, uv);
  return (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0;   // 16-bit packed in R/G
}
vec2 panoUvFor(vec3 dir){
  float u = 0.5 - atan(dir.x, dir.z) / 6.28318530718;
  float v = 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265;
  return vec2(u, v);
}
vec3 sampleSide(sampler2D pano, sampler2D depth, vec3 dir){
  vec2 baseUv = panoUvFor(dir);
  float sceneD = decodeDepth(depth, baseUv);      // 1.0 = far/sky
  float proximity = 1.0 - sceneD;                 // near = 1
  vec2 uv = baseUv - uParallax * proximity * 0.04;
  float d2 = decodeDepth(depth, uv);
  uv = baseUv - uParallax * (1.0 - d2) * 0.04;
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
let switching = false, mixStart = 0;

const el = renderer.domElement;
const hintEl = document.getElementById('hint');

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
function up() { dragging = false; }

el.addEventListener('pointerdown', e => down(e.clientX, e.clientY));
addEventListener('pointermove', e => move(e.clientX, e.clientY));
addEventListener('pointerup', up);
addEventListener('mousemove', e => {
  if (dragging || e.pointerType === 'touch') return;
  markInput();
  targetPx = (e.clientX / innerWidth - .5) * 2 * PARALLAX_X;
  targetPy = (e.clientY / innerHeight - .5) * 2 * PARALLAX_Y;
});
let pinch0 = 0, fov0 = FOV_DEFAULT;
el.addEventListener('touchstart', e => { if (e.touches.length === 2) { pinch0 = dist(e); fov0 = uniforms.uFov.value; } }, { passive: true });
el.addEventListener('touchmove', e => { if (e.touches.length === 2) { markInput(); uniforms.uFov.value = THREE.MathUtils.clamp(fov0 * pinch0 / dist(e), FOV_MIN, FOV_MAX); } }, { passive: true });
function dist(e) { const a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
addEventListener('wheel', e => { markInput(); uniforms.uFov.value = THREE.MathUtils.clamp(uniforms.uFov.value + e.deltaY * 0.02, FOV_MIN, FOV_MAX); });

// ---------------------------------------------------------------- rooms + transitions
function tex(url, srgb) {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
async function switchTo(id, keepView = true) {
  const room = byId[id];
  if (!room || switching || (current && current.id === id)) return;
  switching = true; pendingId = id;
  let pano = null, depth = null;
  try { pano = await loader.loadAsync(room.pano); } catch (e) { console.error('pano load failed', room.pano, e); pano = null; }
  if (room.depth) { try { depth = await loader.loadAsync(room.depth); } catch (e) { console.error('depth load failed', room.depth, e); depth = null; } }
  if (!pano) { switching = false; pendingId = null; console.error('switchTo aborted: no pano for', id); return; }
  uniforms.uPanoB.value = pano || farPixel;
  if (pano) uniforms.uPanoB.value.colorSpace = THREE.SRGBColorSpace;
  uniforms.uDepthB.value = depth || farPixel;
  uniforms.uDepthB.value.minFilter = uniforms.uDepthB.value.magFilter = THREE.LinearFilter;
  mixStart = performance.now();
  if (!keepView) { targetYaw = 0; targetPitch = 0; }
  current = room; pendingId = null;
  buildHotspots(room);
  if (window.__onRoomChanged) window.__onRoomChanged(room);
}
function finishTransition() {
  uniforms.uPanoA.value = uniforms.uPanoB.value;
  uniforms.uDepthA.value = uniforms.uDepthB.value;
  uniforms.uMix.value = 0;
  const old = uniforms.uPanoB.value;
  switching = false;
}

// ---------------------------------------------------------------- hotspots (projected DOM)
const hsLayer = document.getElementById('hotspots');
let hotspotEls = [];
function buildHotspots(room) {
  hotspotEls.forEach(h => h.el.remove()); hotspotEls = [];
  (room.hotspots || []).forEach(h => {
    const d = document.createElement('div');
    d.className = 'hs';
    d.innerHTML = `<div class="dot">${h.icon || '➜'}</div><div class="lbl">${h.label || ''}</div>`;
    d.addEventListener('click', ev => {
      ev.stopPropagation(); markInput();
      if (h.to) { switchTo(h.to); }          // room link
      else { aimTo(h.yaw, h.pitch); }        // feature marker: turn to look at it
    });
    hsLayer.appendChild(d);
    hotspotEls.push({ el: d, ...h });
  });
}
function aimTo(yaw, pitch) {
  // choose the equivalent yaw nearest the current one so we never spin the long way
  let d = yaw - uniforms.uYaw.value;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  targetYaw = uniforms.uYaw.value + d;
  targetPitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  velYaw = velPitch = 0;
}
function projectHotspots() {
  hotspotEls.forEach(h => {
    let dy = h.yaw - uniforms.uYaw.value;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const dx = Math.tan(dy), dyp = Math.tan(h.pitch - uniforms.uPitch.value);
    const tanF = Math.tan(THREE.MathUtils.degToRad(uniforms.uFov.value) / 2);
    const sx = (dx / (tanF * uniforms.uAspect) + 1) / 2;
    const sy = (1 - dyp / tanF) / 2;
    const vis = sx > 0.02 && sx < 0.98 && sy > 0.02 && sy < 0.98;
    h.el.style.display = vis ? 'block' : 'none';
    if (vis) { h.el.style.left = (sx * innerWidth) + 'px'; h.el.style.top = (sy * innerHeight) + 'px'; }
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
  const man = await (await fetch(manifestUrl)).json();
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
  hotspots() { return hotspotEls.map(h => ({ label: h.label, yaw: h.yaw, to: h.to || null })); },
  aim(y, p) { aimTo(y, p); },
  go(id, keepView = true) { return switchTo(id, keepView); },
  limits: { fov: [FOV_MIN, FOV_MAX], pitch: PITCH_LIMIT, tau: INERTIA_TAU, autorotate: AUTOROTATE_SPEED, transition: TRANSITION_S },
};
