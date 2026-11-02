const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const L = require('./life-tree.js');

assert.deepEqual([0, .5, 1].map(L.pixFromR), [30, 60, 120]);
assert.equal(L.pointToAR({x:264,y:64},20)[0],20);
assert.equal(L.pointToAR({x:144,y:500},20)[0],0);
assert.equal(L.rFromX(264),.5);
assert.equal(L.rFromX(144),.5);
const valid = {trajectory_version:3,trajectory_age_now:20,valence:1,path_ar:[[10,.5],[18,-.3]]};
assert.ok(L.isComplete(valid,20)); // Original accepts release before the top.
assert.ok(!L.isComplete(valid,21));
assert.ok(!L.isComplete({...valid,trajectory_version:2},20));
assert.ok(!L.isComplete({...valid,path_ar:[[12,.5],[10,.2]]},20));

// Exercise the actual extracted drawing core using a minimal DOM fixture.
// No separate reimplementation of pointer processing or path encoding.
class Element {
  constructor(tag) { this.tag=tag; this.children=[]; this.handlers={}; this.style={}; this.classList={add(){},remove(){}}; }
  setAttribute(k,v) { this[k]=String(v); }
  appendChild(el) { this.children.push(el); return el; }
  addEventListener(k,fn) { this.handlers[k]=fn; }
  set innerHTML(v) { this.children=[]; }
  setPointerCapture() {}
  getScreenCTM() { return {inverse(){return {};}}; }
}
const sandbox = {window:{},document:{createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t)},
  performance:{now:(()=>{let t=0;return()=>++t;})()},
  DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}}};
vm.runInNewContext(fs.readFileSync(require.resolve('./mentor-draw.js'),'utf8'),sandbox);
const flatten = el=>[el,...el.children.flatMap(flatten)];
function mount(items,prior=[]) {
  let changes=[],finished=[];
  const host=new Element('div');
  new sandbox.window.MentorLifeTree({finishTrial:d=>finished.push(d)})._draw(host,{
    max_age:20,selected_items:items,prior_events:prior,is_focal_now:true,hard_max:items.length,
    suggest_min:items.length,suggest_max:items.length,allow_skip:false,on_change:e=>changes.push(JSON.parse(JSON.stringify(e))),
  });
  const find=t=>flatten(host).find(e=>e.textContent===t);
  const svg=flatten(host).find(e=>e.tag==='svg');
  const event=(x,y)=>({clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,preventDefault(){}});
  return {host,svg,find,changes,finished,stroke(points){
    svg.handlers.pointerdown(event(...points[0]));
    for(const p of points.slice(1))svg.handlers.pointermove(event(...p));
    svg.handlers.pointerup(event(...points.at(-1)));
  },event};
}
const items=[{item_key:'award',display_label:'体育获奖',valence:1,select_order:1},{item_key:'injury',display_label:'体育伤病',valence:-1,select_order:2}];
const m=mount(items);
m.find('这些画完了，继续').handlers.click(); assert.equal(m.finished.length,0);
m.stroke([[100,300],[260,220],[280,250],[290,100]]); // Wrong-side onset clamped; age cannot go backwards.
assert.equal(m.changes.length,1);
assert.equal(m.changes[0][0].side_then,1);
assert.ok(m.changes[0][0].path_ar.every((p,i,a)=>!i||p[0]>=a[i-1][0]));
assert.ok(flatten(m.host).some(e=>e.textContent?.includes('当前第 2 件')));
m.stroke(Array.from({length:180},(_,i)=>[144+i*.8,400-i*1.8]));
let last=m.changes.at(-1)[1];
assert.ok(last.path_ar_n<=32); assert.ok(last.cross_axis); assert.equal(last.side_then,-1); assert.equal(last.side_now,1);
assert.ok(last.path_len>0); assert.ok(last.draw_ms>0); assert.ok(last.age_cross!=null);
m.find('撤销').handlers.click(); assert.equal(m.changes.at(-1).length,1);
m.svg.handlers.pointerdown(m.event(144,300));m.svg.handlers.pointermove(m.event(120,100));m.svg.handlers.pointercancel(m.event(120,100));
assert.equal(m.changes.at(-1).length,1);
m.stroke([[144,300],[164,100]]);m.find('这些画完了，继续').handlers.click();
assert.equal(m.finished[0].events.length,2);
const resumed=mount(items,m.finished[0].events);
resumed.find('撤销').handlers.click();assert.equal(resumed.changes.at(-1).length,1);
const single=mount([items[0]]);single.stroke([[264,300],[274,200]]);single.find('这些画完了，继续').handlers.click();
assert.equal(single.finished[0].events.length,1);
assert.equal(single.finished[0].events[0].age_end,14); // No added endpoint-to-now enforcement.
const empty=mount([]);empty.find('这些画完了，继续').handlers.click();assert.equal(empty.finished[0].events.length,0);
console.log('PASS: original impact scale, sequential drawing, onset clamp, age monotonicity, 32-point cap, crossing, cancel, undo/resume, all-item gate, single/zero-event histories.');
