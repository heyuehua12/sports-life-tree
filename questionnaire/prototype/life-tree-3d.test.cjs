const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const LifeTree = require('./life-tree.js');
const context = vm.createContext({ LifeTree });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'life-tree-3d.js'), 'utf8'), context);
const base = { id: 'injury', label: '<img src=x onerror=alert(1)>', valence: -1, trajectory_version: 3,
  trajectory_age_now: 20, path_ar: [[12, -.8], [16, -.3], [20, .1]], age_start: 12,
  age_end: 20, r_then: .8, r_now: .1, centrality: 0, obj_raw: 90, obj_w: .5, theta: -1.57 };
const details = { injury: { where: '训练场', who: ['队友', '家人'], why: '伤病或身体状态', how: '有人帮助后改善', closeness: .7 } };
const before = JSON.stringify(base);
const payload = context.LifeTree3D.payloadFor([base, { ...base, id: 'old', trajectory_version: 1 }, { ...base, id: 'wrong-age', trajectory_age_now: 19 }], details, 20);
assert.equal(payload.events.length, 1);
const event = payload.events[0];
assert.equal(event.event_id, 'injury'); assert.equal(event.item_key, base.label);
assert.equal(event.centrality, 0); assert.equal(event.who, '队友、家人'); assert.equal(event.closeness, .7);
assert.equal(event.obj_raw, null); assert.equal(event.obj_w, null); assert.equal(event.theta, null);
assert.equal(JSON.stringify(event.path_ar), JSON.stringify(base.path_ar));
assert.equal(JSON.stringify(base), before, 'display does not mutate stored answers');
assert.equal(context.LifeTree3D.payloadFor([], {}, 20).events.length, 0);
const source = fs.readFileSync(path.resolve(__dirname, '../../reference_notes/mentor-3d-reference.html'), 'utf8').replace(/\r\n/g, '\n');
const generated = fs.readFileSync(path.join(__dirname, 'mentor-3d/index.html'), 'utf8');
for (const name of ['polarXZ', 'eventTheta', 'pathARPoints', 'addTrajectory', 'addFloor2DArrow', 'addCrownComposite', 'applyCameraForView']) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\nfunction ', start + 1);
  const block = source.slice(start, end < 0 ? undefined : end);
  assert.ok(start >= 0 && generated.includes(block), 'preserves original geometry: ' + name);
}
const moduleScript = generated.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
new vm.Script(moduleScript.replace(/^import .*;\r?\n/gm, ''), { filename: 'adapted-mentor-module.js' });
assert.ok(generated.includes("event.source !== parent"));
assert.ok(generated.includes("event.origin !== location.origin"));
assert.ok(!generated.includes('https://cdn.jsdelivr.net/'));
console.log('PASS: 3D bridge uses completed paths only, preserves signed data and zero centrality, maps original answers without invented norms, leaves drafts unchanged; original 3D geometry preserved and module syntax valid.');
