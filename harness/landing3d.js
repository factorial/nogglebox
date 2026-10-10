// 3D background for the landing page: a glowing sun and puffy clouds over rolling hills.
// Runs only while the landing page is showing; if WebGL isn't available, the plain CSS
// sky in harness.css stays as the background.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const landing = document.getElementById("landing");
const canvas = document.getElementById("bg3d");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  console.warn("[landing3d] WebGL unavailable; keeping the flat background.", err);
  canvas.remove();
  throw err; // stops this module only; the rest of the site is unaffected
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.classList.add("has-3d");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 12);

// Soft studio reflections give the sun and clouds a gentle sheen.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xcff0ff, 0x7be07b, 1.1));
const sunLight = new THREE.DirectionalLight(0xfff1d0, 2.2);
sunLight.position.set(6, 8, 6);
scene.add(sunLight);

// ---------- helpers ----------
// Visible half-width/height of the view at a given distance in front of the camera.
function halfView(dist) {
  const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
  return { w: h * camera.aspect, h };
}

// ---------- sun ----------
const sun = new THREE.Group();
const sunBall = new THREE.Mesh(
  new THREE.SphereGeometry(1.3, 40, 28),
  new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb300, emissiveIntensity: 0.9, roughness: 0.5 })
);
sun.add(sunBall);
const rayMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffc300, emissiveIntensity: 0.7 });
for (let i = 0; i < 12; i++) {
  const ray = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 16), rayMat);
  const a = (i / 12) * Math.PI * 2;
  ray.position.set(Math.cos(a) * 1.85, Math.sin(a) * 1.85, 0);
  ray.rotation.z = a - Math.PI / 2;
  sun.add(ray);
}
scene.add(sun);
const SUN = { u: 0.78, v: 0.72, z: -14 };

// ---------- clouds ----------
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.25 });
const puff = new THREE.SphereGeometry(1, 24, 16);
const clouds = [];
for (let i = 0; i < 5; i++) {
  const c = new THREE.Group();
  const n = 4 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) {
    const p = new THREE.Mesh(puff, cloudMat);
    const r = 0.6 + Math.random() * 0.5;
    p.scale.set(r, r * 0.85, r);
    p.position.set((k - n / 2) * 0.75, Math.random() * 0.35 + (k % 2 ? 0.25 : 0), Math.random() * 0.3);
    c.add(p);
  }
  scene.add(c);
  clouds.push({ group: c, u: Math.random() * 2.4 - 1.2, v: 0.35 + Math.random() * 0.5, z: -12 - Math.random() * 6, speed: 0.012 + Math.random() * 0.012 });
}

// ---------- rolling hills ----------
const hills = [
  { color: 0x5fd068, u: -0.55, z: -9, r: 7 },
  { color: 0x7be07b, u: 0.45, z: -7, r: 6.5 },
  { color: 0x4cc35a, u: 0.0, z: -4, r: 6 },
].map((h) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ color: h.color, roughness: 0.85 }));
  m.scale.set(h.r * 1.6, h.r * 0.55, h.r);
  scene.add(m);
  return { mesh: m, ...h };
});

// ---------- layout, motion, render ----------
function place(obj, u, v, z) {
  const d = camera.position.z - z;
  const hv = halfView(d);
  obj.position.set(u * hv.w, v * hv.h, z);
}

function resize() {
  const w = landing.clientWidth || innerWidth, h = landing.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Portrait screens: pull back a bit so the scene doesn't feel cramped.
  camera.fov = camera.aspect < 1 ? 55 : 45;
  camera.updateProjectionMatrix();
  for (const hl of hills) {
    const hv = halfView(camera.position.z - hl.z);
    hl.mesh.position.set(hl.u * hv.w, -hv.h - hl.r * 0.18, hl.z);
  }
}
addEventListener("resize", resize);

// Camera leans toward the finger/mouse for a parallax feel.
const lean = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (e) => {
  lean.tx = (e.clientX / innerWidth - 0.5) * 2;
  lean.ty = (e.clientY / innerHeight - 0.5) * 2;
});

let lastFrame = performance.now();
const tick = () => { const now = performance.now(), d = (now - lastFrame) / 1000; lastFrame = now; return d; };
let t = 0;
function frame() {
  const dt = Math.min(0.05, tick()) * (reduceMotion ? 0.25 : 1);
  t += dt;

  lean.x += (lean.tx - lean.x) * 0.04;
  lean.y += (lean.ty - lean.y) * 0.04;
  camera.position.x = Math.sin(t * 0.15) * 0.6 + lean.x * 0.8;
  camera.position.y = Math.cos(t * 0.11) * 0.3 - lean.y * 0.5;
  camera.lookAt(0, 0, -4);

  place(sun, SUN.u, SUN.v, SUN.z);
  sun.rotation.z = t * 0.12;
  sunBall.scale.setScalar(1 + Math.sin(t * 2) * 0.03);

  for (const c of clouds) {
    c.u += c.speed * dt;
    if (c.u > 1.4) c.u = -1.4;
    place(c.group, c.u, c.v, c.z);
  }

  renderer.render(scene, camera);
}

// Only animate while the landing page is on screen (saves battery during videos/games).
function sync() {
  const showing = document.body.classList.contains("is-home");
  renderer.setAnimationLoop(showing ? frame : null);
  if (showing) { tick(); resize(); }
}
new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
sync();
