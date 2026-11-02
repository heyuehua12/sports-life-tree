const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM, VirtualConsole} = require('jsdom');
const catalog = require('./life-event-catalog.js');
const sourceContext = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../../reference_notes/mentor-options.js'),'utf8'),sourceContext);
const original = sourceContext.window.LT_OPTIONS;
for (const [side, valence] of [['neg',-1],['pos',1]]) {
  const expected = Array.from(original[side].categories).flatMap(category=>Array.from(original[side].items[category],item=>({label:item.t,category,bridge:item.a})));
  const actual = catalog.filter(e=>e.valence===valence).map(e=>({label:e.label,category:e.theme,bridge:e.aslec_bridge}));
  assert.deepEqual(actual,expected,'every original wording, category, order and ASLEC bridge is preserved');
}
assert.equal(catalog.filter(e=>e.valence<0).length,35);
assert.equal(catalog.filter(e=>e.valence>0).length,17);
for(const item of catalog){
  const pair=sourceContext.window.LT_DOMAIN_PAIRS[item.group_index];
  assert.equal(item.theme,pair[item.valence<0?'neg':'pos']);
  assert.ok(!('obj_raw' in item)&&!('obj_w' in item),'reference weights are not active self-reports or sports norms');
}

function mount(reducedMotion=false){
  const errors=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM('<div id="host"></div>',{url:'https://example.test/',runScripts:'outside-only',virtualConsole});
  const w=dom.window;const timers=new Map();let timerId=0;
  w.setTimeout=(callback,ms)=>{timers.set(++timerId,{callback,ms,kind:'timeout'});return timerId;};
  w.setInterval=(callback,ms)=>{timers.set(++timerId,{callback,ms,kind:'interval'});return timerId;};
  w.clearTimeout=w.clearInterval=id=>timers.delete(id);
  w.matchMedia=()=>({matches:reducedMotion});
  new vm.Script(fs.readFileSync(path.join(__dirname,'mentor-tutor.js'),'utf8')).runInContext(dom.getInternalVMContext());
  const progress=[],completed=[];
  const host=w.document.getElementById('host');
  w.LifeTreeTutor.render({host,onProgress:data=>progress.push(JSON.parse(JSON.stringify(data))),onComplete:data=>completed.push(data)});
  const getSVG=()=>{const svg=host.querySelector('svg');svg.getBoundingClientRect=()=>({left:0,top:0,width:300,height:260});return svg;};
  const pointer=(type,x,y,id=1)=>{const event=new w.MouseEvent(type,{clientX:x,clientY:y,bubbles:true,cancelable:true});Object.defineProperty(event,'pointerId',{value:id});getSVG().dispatchEvent(event);};
  return {dom,w,host,timers,errors,progress,completed,pointer,getSVG,close(){w.LifeTreeTutor.dispose();assert.equal(timers.size,0);dom.window.close();}};
}
const t=mount();
assert.equal([...t.timers.values()].filter(x=>x.kind==='interval').length,1);
assert.ok(t.host.querySelector('.lt-tutor-done').disabled);
t.pointer('pointerdown',156,210);t.pointer('pointerup',156,210);
t.pointer('pointerdown',226,210);t.pointer('pointermove',226,136);t.pointer('pointermove',226,62);t.pointer('pointerup',226,62);
assert.equal(t.progress.at(-1).success,false);assert.equal(t.progress.at(-1).failures,1);assert.ok(t.host.querySelector('.lt-tutor-done').disabled);
t.pointer('pointerdown',156,210);assert.ok(![...t.timers.values()].some(x=>x.ms===700),'starting another attempt cancels stale failure clearing');
t.pointer('pointermove',86,136);t.pointer('pointerup',86,136,2);assert.equal(t.progress.at(-1).success,false,'a different pointer cannot finish a stroke');
t.pointer('pointermove',226,62);t.pointer('pointerup',226,62);
assert.equal(t.progress.at(-1).attempts,2);assert.equal(t.progress.at(-1).failures,1);assert.equal(t.progress.at(-1).success,true);
assert.deepEqual(t.progress.at(-1).path_cells,['r2c1','r1c0','r0c2']);
t.host.querySelector('.lt-tutor-done').click();assert.equal(t.completed.length,1);assert.equal(t.timers.size,0);assert.deepEqual(t.errors,[]);t.close();

const cancel=mount();cancel.pointer('pointerdown',156,210);cancel.pointer('pointerup',156,210);
cancel.pointer('pointerdown',156,210);cancel.pointer('pointermove',86,136);cancel.pointer('pointercancel',86,136);cancel.pointer('pointerup',226,62);
assert.equal(cancel.progress.length,0);assert.ok(cancel.host.querySelector('.lt-tutor-done').disabled);cancel.close();

const replay=mount();const firstGuide=[...replay.timers.keys()][0];replay.host.querySelector('#tutorReplay').click();
assert.equal(replay.timers.has(firstGuide),false);assert.equal([...replay.timers.values()].filter(x=>x.kind==='interval').length,1);replay.close();

const keyboard=mount(true);assert.equal([...keyboard.timers.values()].filter(x=>x.kind==='interval').length,0);
function key(value,count=1){for(let i=0;i<count;i++)keyboard.getSVG().dispatchEvent(new keyboard.w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));}
key(' ');key(' ');key('ArrowLeft',5);key('ArrowUp',5);key('ArrowRight',10);key('ArrowUp',5);key('Enter');
assert.ok(!keyboard.host.querySelector('.lt-tutor-done').disabled);assert.equal(keyboard.progress.at(-1).success,true);
keyboard.host.querySelector('.lt-tutor-done').click();assert.equal(keyboard.completed.length,1);assert.deepEqual(keyboard.errors,[]);keyboard.close();

// Objective palette checks supplement DOM checks; they do not claim a visual audit.
function luminance(hex){const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);}
for(const [text,bg] of [['3f6251','ffffff'],['596b62','ffffff'],['263c33','f1f5f2'],['285137','e3eee6'],['673673','eee5f1']])assert.ok(contrast(text,bg)>=4.5,`text contrast: ${text} / ${bg}`);
console.log('PASS: exact 52-prompt mentor catalog and category pairing; original tutorial sequence, failed retry, pointer ownership/cancel, replay timer cleanup, reduced motion and keyboard completion; core text palette contrast (DOM checks, no browser rendering claim).');
