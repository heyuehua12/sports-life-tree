// Adapt the published NRLab viewer, leaving the downloaded snapshot untouched.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sourceFile = path.resolve(__dirname, '../../reference_notes/mentor-3d-reference.html');
let html = fs.readFileSync(sourceFile, 'utf8').replace(/\r\n/g, '\n');
function replace(before, after) {
  if (!html.includes(before)) throw new Error('Source contract changed: ' + before.slice(0, 90));
  html = html.replace(before, after);
}
replace('<link rel="stylesheet" href="/css/nrlab-site-chrome.css"/>', '');
replace('<div id="nrlab-site-nav" data-active="tools" data-tools-crumb="life-tree-viz"></div>', '');
replace('<script src="/js/nrlab-site-nav.js" defer></script>', '');
replace('<title>生命树三维结果 v3.5 · NRLab Tools</title>', '<title>生命树 3D · 博导原版查看器本地适配</title>');
html = html.replace(/href="\/tools\/life-tree"/g, 'href="https://zhenghui.fun/tools/life-tree" target="_blank" rel="noopener"');
html = html.replace(/href="\/tools\/"/g, 'href="https://zhenghui.fun/tools/" target="_blank" rel="noopener"');
replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', '../vendor/three/three.module.js');
replace('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', '../vendor/three/addons/');
replace('</head>', `<style>
  * { box-sizing: border-box; }
  body.nrlab-viz { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  body.nrlab-viz #ui { position: relative; inset: auto; width: 100%; max-height: 178px; flex: none; margin: 0; border-radius: 0; padding: 12px 16px; }
  body.nrlab-viz #c { position: relative; inset: auto; min-height: 220px; flex: 1; overflow: hidden; touch-action: none; }
  body.nrlab-viz #axisbar { position: relative; inset: auto; flex: none; margin: 0; border-radius: 0; }
  body.nrlab-viz #anno { top: 174px; right: 12px; max-height: calc(100vh - 235px); }
  #anno .kv { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  #anno .k { overflow-wrap: anywhere; }
  #loading { position: absolute; top: 52%; width: 100%; text-align: center; color: #c9d0dc; padding: 20px; pointer-events: none; }
  body.embedded #ui h1, body.embedded #ui > p.hint, body.embedded #btn-four, body.embedded details.adv { display: none; }
  body.embedded #ui { max-height: 150px; }
  body.embedded #anno { top: 150px; max-height: calc(100vh - 210px); }
  #err { color: #b8c6bf; }
  @media (max-width: 720px) {
    body.nrlab-viz #ui { inset: auto; max-height: 190px; }
    body.nrlab-viz #c { inset: auto; }
    body.nrlab-viz #anno, body.embedded #anno { top: 156px; left: 8px; right: 8px; max-height: calc(100vh - 185px); width: auto; }
    #ui .row { gap: 6px; margin-top: 6px; }
    #ui button { font-size: .75rem; padding: .45rem .6rem; }
    body.embedded #ui { max-height: 150px; padding: 10px; }
  }
</style>
</head>`);
replace('<div id="c"></div>', '<div id="c" aria-label="可拖动旋转的生命树三维场景"></div><div id="loading" role="status">正在加载本地 3D 查看器…</div>');
replace('import * as THREE from "three";', `import * as THREE from "three";
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
const embedded = new URLSearchParams(location.search).has('embedded');
if (embedded) document.body.classList.add('embedded');`);
replace('const renderer = new THREE.WebGLRenderer({ antialias: true });', `let renderer;
let softwareRenderer = false, needsSoftwareRender = true, lastSoftwarePose = '';
const canvas = document.createElement('canvas');
let gl = null;
try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch (_) {}
try { if (gl) renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true }); } catch (_) {}
if (!renderer) { renderer = new SVGRenderer(); softwareRenderer = true; renderer.setQuality('low'); }
renderer.domElement.setAttribute('aria-label', softwareRenderer ? '生命树三维场景（兼容渲染）' : '生命树三维场景');`);
replace('window.addEventListener("resize", resize);', 'window.addEventListener("resize", resize);\nnew ResizeObserver(resize).observe(host);');
// Original camera framing assumes a full-window canvas. Keep its orientation,
// then fit the same geometry inside the smaller questionnaire viewport.
replace('function resize() {', `function fitCameraToViewport() {
  if (!lastPayload || !treeGroup.children.length) return;
  treeGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(treeGroup);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const direction = camera.position.clone().sub(controls.target).normalize();
  const inverse = camera.quaternion.clone().invert();
  const tanV = Math.tan(camera.fov * Math.PI / 360);
  const tanH = tanV * camera.aspect;
  let distance = 1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center).applyQuaternion(inverse);
    distance = Math.max(distance, corner.z + Math.abs(corner.x) / tanH, corner.z + Math.abs(corner.y) / tanV);
  }
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance * 1.15);
  controls.update();
  needsSoftwareRender = true;
}
function resize() {`);
replace('  renderer.setSize(w, h, false);', '  renderer.setSize(w, h, false);\n  fitCameraToViewport();\n  needsSoftwareRender = true;');
replace('  applyCameraForView(trunkH);', '  applyCameraForView(trunkH);\n  fitCameraToViewport();');
replace('  applyCameraForView(lastTrunkH);', '  applyCameraForView(lastTrunkH);\n  fitCameraToViewport();');
replace('function clearTree() {', 'function clearTree() {\n  needsSoftwareRender = true;');
replace('  s.scale.set(1.2, 0.3, 1);', '  s.userData.text = text; s.userData.textFill = fill || "#c9d0dc";\n  s.scale.set(1.2, 0.3, 1);');
replace('function loop() {', `function renderSoftwareScene() {
  const pose = [...camera.position.toArray(), ...camera.quaternion.toArray(), selectedId, showFloorProj, viewMode].join(',');
  if (!needsSoftwareRender && pose === lastSoftwarePose) return;
  needsSoftwareRender = false; lastSoftwarePose = pose;
  const sprites = [];
  scene.traverseVisible(obj => { if (obj.isSprite) { sprites.push(obj); obj.visible = false; } });
  renderer.render(scene, camera);
  const labels = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labels.setAttribute('pointer-events', 'none');
  const w = host.clientWidth, h = host.clientHeight;
  sprites.forEach(sprite => {
    sprite.visible = true;
    const world = sprite.getWorldPosition(new THREE.Vector3());
    const p = world.clone().project(camera);
    if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1 || !sprite.userData.text) return;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.textContent = sprite.userData.text;
    label.setAttribute('x', p.x * w / 2); label.setAttribute('y', -p.y * h / 2);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('fill', sprite.userData.textFill); label.setAttribute('opacity', sprite.material.opacity);
    const pixels = sprite.scale.y * h / (2 * Math.tan(camera.fov * Math.PI / 360) * Math.max(1, camera.position.distanceTo(world)));
    label.setAttribute('font-size', Math.max(9, Math.min(16, pixels * .6)));
    label.setAttribute('font-family', 'sans-serif'); label.setAttribute('font-weight', '600');
    labels.appendChild(label);
  });
  renderer.domElement.appendChild(labels);
}
function loop() {`);
replace('  renderer.render(scene, camera);\n}\nloop();', '  if (softwareRenderer) renderSoftwareScene();\n  else renderer.render(scene, camera);\n}\nloop();');
// Escape user-written event names before rendering the original annotations.
replace('  return String(v);\n}\n\nfunction layerBlock', `  return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function layerBlock`);
// Preserve the original .05 visual minimum, but do not turn zero into .5.
html = html.replaceAll('Number(r) || 0.5', '(r != null && Number.isFinite(Number(r)) ? Number(r) : 0.5)');
replace('document.getElementById("btn-four").click();\n</script>', `
document.getElementById('loading').hidden = true;
if (!embedded) {
  document.getElementById('btn-four').click();
  errEl.textContent = '原版四条典型演示（非你的作答数据）';
} else { errEl.textContent = '等待当前作答轨迹…'; }
window.addEventListener('message', event => {
  if (!embedded || event.origin !== location.origin || event.source !== parent || event.data?.type !== 'sports-life-tree-data') return;
  try {
    const payload = normalizePayload(event.data.payload);
    applyPayload(payload);
    errEl.textContent += ' · 拖动旋转，滚轮或双指缩放' + (softwareRenderer ? ' · 兼容渲染' : '');
    parent.postMessage({ type: 'sports-life-tree-rendered', count: payload.events.length }, location.origin);
  } catch (error) {
    errEl.textContent = '三维显示失败：' + error.message;
    parent.postMessage({ type: 'sports-life-tree-error', message: error.message }, location.origin);
  }
});
if (embedded) parent.postMessage({ type: 'sports-life-tree-ready' }, location.origin);
</script>`);
replace('</body>', `<script>
setTimeout(() => { const el = document.getElementById('loading'); if (!el.hidden) el.textContent = '3D 组件尚未加载完成，请刷新页面；若持续无法显示，请检查浏览器 WebGL 支持。'; }, 15000);
</script>
</body>`);
const outDir = path.join(__dirname, 'mentor-3d');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(outDir, 'SOURCE.json'), JSON.stringify({
  source_url: 'https://zhenghui.fun/tools/life-tree-viz', retrieved_date: '2026-11-02',
  source_sha256: crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'),
  viewer: 'NRLab life-tree 3D v3.5', three_version: '0.160.0',
  adaptation: ['Local dependencies', 'Same-origin questionnaire bridge', 'Embedded layout', 'Annotation text escaping', 'Explicit zero radius handling', 'SVGRenderer compatibility fallback with original Three.js geometry', 'Fit original camera orientation to viewport bounds'],
}, null, 2));
console.log('Adapted original NRLab 3D viewer to mentor-3d/index.html');
