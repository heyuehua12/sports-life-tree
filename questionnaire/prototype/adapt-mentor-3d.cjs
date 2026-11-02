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
  .scene-mapping-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; font-family: system-ui, sans-serif; }
  .scene-mapping-toolbar { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; gap: 6px; flex-wrap: wrap; pointer-events: auto; width: fit-content; }
  .scene-mapping-toolbar button { min-height: 36px; padding: 7px 10px; border: 1px solid #55697b; border-radius: 6px; color: #edf2f4; background: #18232e; font: 12px/1.3 system-ui,sans-serif; cursor: pointer; }
  .scene-mapping-toolbar button[aria-pressed="true"] { border-color: #92b3a1; background: #263b35; }
  .scene-mapping-toolbar button:focus-visible { outline: 2px solid #d9e9df; outline-offset: 2px; }
  .scene-mapping-toolbar button:disabled { opacity: .5; cursor: default; }
  .scene-mapping-status { position: absolute; top: 54px; left: 10px; font-size: 11px; color: #d1dbe1; background: #0f1218cc; max-width: calc(100% - 20px); }
  .scene-mapping-legend { position: absolute; bottom: 8px; left: 8px; right: 8px; padding: 8px 10px; color: #d7e2e8; background: #16212dea; border: 1px solid #344453; border-radius: 7px; font-size: 11px; line-height: 1.8; }
  .scene-mapping-wires { position: absolute; width: 100%; height: 100%; inset: 0; overflow: hidden; }
  .scene-mapping-wires path { fill: none; stroke-width: 1; opacity: .7; }
  .scene-mapping-callout { position: absolute; top: 0; left: 0; padding: 5px 7px; background: #16202eee; border: 1px solid; border-radius: 5px; color: #f0f4f6; font-size: 11px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .scene-mapping-callout[hidden], .scene-mapping-labels[hidden], .scene-mapping-legend[hidden] { display: none; }
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
import { createMappingLayer } from '../mapping-scene.mjs';
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
  box.expandByObject(mappingLayer.group);
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
replace('function clearTree() {\n  needsSoftwareRender = true;', 'function clearTree() {\n  mappingLayer.clear();\n  needsSoftwareRender = true;');
replace('const raycaster = new THREE.Raycaster();', `const mappingLayer = createMappingLayer({THREE, scene, host, camera,
  pointFor:polarToThree, registerPickable:tagPickable, invalidate:()=>{ needsSoftwareRender = true; },
  onDetails:id=>{const ev=eventById.get(id);if(ev){showAnno(ev);annoEl.classList.add('open');}}});
const raycaster = new THREE.Raycaster();`);
replace('  events.forEach((ev) => addTrajectory(ev, ageLo, trunkAgeHi, trunkH, ageNow));', `  events.forEach((ev) => addTrajectory(ev, ageLo, trunkAgeHi, trunkH, ageNow));
  const mappingEvents = events.map(ev=>({...ev,path_ar:Array.isArray(ev.path_ar)&&ev.path_ar.length>=2?ev.path_ar:synthPathAR(ev,ageNow)}));
  mappingLayer.build(mappingEvents,deriveF,ageLo,trunkAgeHi,trunkH,ageNow);`);
replace('  selectedId = eventId;\n  clearHighlightExtras();', '  selectedId = eventId;\n  mappingLayer.select(eventId);\n  clearHighlightExtras();');
replace('  const hits = raycaster.intersectObjects(pickables, false);', `  if (e.target.closest('button')) return;
  const visiblePickables = pickables.filter(obj=>{for(let p=obj;p;p=p.parent)if(!p.visible)return false;return true;});
  const hits = raycaster.intersectObjects(visiblePickables, false);`);
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
replace('  renderer.render(scene, camera);\n}\nloop();', '  mappingLayer.update();\n  if (softwareRenderer) renderSoftwareScene();\n  else renderer.render(scene, camera);\n}\nloop();');
// Escape user-written event names before rendering the original annotations.
replace('  return String(v);\n}\n\nfunction layerBlock', `  return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function layerBlock`);
// Preserve the original .05 visual minimum, but do not turn zero into .5.
html = html.replaceAll('Number(r) || 0.5', '(r != null && Number.isFinite(Number(r)) ? Number(r) : 0.5)');
// The questionnaire supplies canonical mappings, including explicit missing values.
replace('function deriveF(ev) {', 'function deriveF(ev) {\n  if (ev.mapping?.fields) return ev.mapping.fields;');
replace('  const deg = Math.round(F.F18_theta * 180 / Math.PI);', '  const deg = F.F18_theta == null ? "—" : Math.round(F.F18_theta * 180 / Math.PI);');
replace(': F.F20_delta_dir === "up" ? "加重" : "平稳";', ': F.F20_delta_dir === "up" ? "影响增强" : F.F20_delta_dir === "flat" ? "变化较小" : "变化未填写";');
replace('F11–F12 · 构念5 客观常模','F11–F12 · 构念5 原版条目参考权重');
replace('["F12 obj_w", F.F12_obj_w],','["F12 obj_w", F.F12_obj_w],\n      ["权重说明", ev.mapping ? "沿用博导条目参考；体育新增、自填或多条目合并不套用权重" : "原版模拟示例"],');
replace('  const F = deriveF(ev);', `  if (embedded) parent.postMessage({type:'sports-life-tree-event-selected',id:ev.event_id},location.origin);
  const F = deriveF(ev);`);
replace('  annoEl.classList.add("open");\n}\n\nfunction addDashedDrop', '  if (!ev.mapping) annoEl.classList.add("open");\n}\n\nfunction addDashedDrop');
replace('document.getElementById("btn-four").click();\n</script>', `
document.getElementById('loading').hidden = true;
if (!embedded) {
  document.getElementById('btn-four').click();
  errEl.textContent = '原版四条典型演示（非你的作答数据）';
} else { errEl.textContent = '等待当前作答轨迹…'; }
window.addEventListener('message', event => {
  if (embedded && event.origin === location.origin && event.source === parent && event.data?.type === 'sports-life-tree-select-event') {
    const ev = lastPayload?.events.find(item => String(item.event_id) === String(event.data.id));
    if (ev) { setHighlight(ev.event_id); showAnno(ev); }
    return;
  }
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
  adaptation: ['Local dependencies', 'Same-origin questionnaire bridge and selection synchronization', 'Embedded layout', 'Annotation text escaping', 'Explicit zero radius handling', 'Canonical F0–F20 mappings with missing values preserved', 'Additional in-scene mapping glyphs, projected callouts, legend and visibility controls', 'SVGRenderer compatibility fallback with original Three.js geometry', 'Fit original camera orientation to viewport bounds'],
}, null, 2));
console.log('Adapted original NRLab 3D viewer to mentor-3d/index.html');
