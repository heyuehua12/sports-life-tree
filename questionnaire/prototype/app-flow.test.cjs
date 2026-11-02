const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const KEY='sports-life-tree-prototype-v0.1';
function mount(saved){
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const errors=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:'https://example.test/sports-life-tree/questionnaire/prototype/',runScripts:'outside-only',virtualConsole:console});
  const w=dom.window;w.scrollTo=()=>{};w.scrollBy=()=>{};w.confirm=()=>true;w.alert=message=>{errors.push(message);};
  if(saved)w.localStorage.setItem(KEY,JSON.stringify(saved));
  const context=dom.getInternalVMContext();
  for(const match of html.matchAll(/<script src="([^"]+)"><\/script>/g))new vm.Script(fs.readFileSync(path.join(__dirname,match[1]),'utf8'),{filename:match[1]}).runInContext(context);
  return {dom,w,doc:w.document,errors,run:code=>vm.runInContext(code,context)};
}
function click(m,selector){const el=m.doc.querySelector(selector);assert.ok(el,'missing '+selector);el.click();}
function change(m,selector,value){const el=m.doc.querySelector(selector);assert.ok(el,'missing '+selector);el.value=value;el.dispatchEvent(new m.w.Event('change',{bubbles:true}));}
function input(m,selector,value){const el=m.doc.querySelector(selector);assert.ok(el);el.value=value;el.dispatchEvent(new m.w.Event('input',{bubbles:true}));}
function background(m,training=false,competition=false){
  input(m,'#age','20');click(m,`[data-choice="training_history"] [data-value="${training}"]`);click(m,`[data-choice="competition_history"] [data-value="${competition}"]`);
  if(competition)click(m,'[data-choice="award_history"] [data-value="true"]');
  click(m,'#nextBtn');assert.equal(m.run('state.step'),1);
}
function select(m,id,relation){click(m,`[data-event="${id}"]`);change(m,`#relation-${id}`,relation);}
const m=mount();background(m);
assert.ok(m.doc.querySelector('[data-event="life_academic_success"]'));
assert.equal(m.doc.querySelector('[data-event="award"]'),null);
select(m,'life_academic_success','none');
assert.ok(!m.doc.querySelector('[data-step="2"]').disabled);
click(m,'#nextBtn');assert.equal(m.run('state.step'),2);assert.ok(m.doc.querySelector('#mentorTree svg'));
// Drawing geometry itself is exercised by life-tree.test.cjs. Supply two real
// signed path points here to test the surrounding flow without browser APIs.
m.run("state.events.forEach(e=>Object.assign(e,{trajectory_version:3,trajectory_age_now:20,path_ar:[[15,.7],[20,.3]],age_start:15,age_end:20,r_then:.7,r_now:.3}));");
click(m,'#nextBtn');assert.equal(m.run('state.step'),3);
assert.ok(!m.doc.querySelector('[data-scale$="|autonomy"]'));
assert.ok(!m.doc.querySelector('[data-detail-field$="|competition_level"]'));
click(m,'[data-chip="life_academic_success|who|家人"]');
input(m,'#rating-life_academic_success-closeness','0');
input(m,'#rating-life_academic_success-centrality','0');
input(m,'#rating-life_academic_success-now_salience','0');
click(m,'#nextBtn');assert.equal(m.run('state.step'),4);assert.ok(m.doc.querySelector('#commonTree2D svg'));
let payload=m.w.buildPayload();assert.equal(payload.events[0].details.closeness,0);assert.equal(payload.events[0].centrality,0);assert.equal(payload.events[0].details.autonomy,null);assert.equal(payload.process.n_non_sports,1);assert.equal(payload.process.sports_specialist_response,'not_applicable_no_exposure');assert.equal(payload.process.outcome_scales_status,'not_integrated');
const before=m.run('JSON.stringify(state.events)');click(m,'[data-tree-filter="sports"]');assert.equal(m.doc.querySelector('#threeDTree iframe'),null);assert.equal(m.run('JSON.stringify(state.events)'),before);
click(m,'[data-tree-filter="all"]');change(m,'#treeDomain','学业');assert.ok(m.doc.querySelector('#commonTree2D polyline'));assert.equal(m.run('JSON.stringify(state.events)'),before);
assert.deepEqual(m.errors,[]);m.dom.window.close();

const z=mount();background(z);click(z,'[name="event-response"][value="prefer_not_to_answer"]');click(z,'#nextBtn');assert.equal(z.run('state.step'),4);assert.equal(z.w.buildPayload().process.event_response,'prefer_not_to_answer');assert.equal(z.doc.querySelector('#threeDTree'),null);assert.deepEqual(z.errors,[]);z.dom.window.close();

const t=mount();background(t,true,true);select(t,'life_help_received','none');select(t,'support','training');
change(t,'#merge-support','life_help_received');click(t,'[data-merge="support"]');assert.equal(t.run('state.events.length'),1);change(t,'#relation-life_help_received','training');
assert.equal(t.run('state.merge_history.length'),1);assert.equal(t.run('state.events[0].source_catalog_ids.length'),2);assert.ok(t.doc.querySelector('[data-event="support"]').disabled);
click(t,'#nextBtn');assert.equal(t.run('state.step'),2);
t.run("state.events.forEach(e=>Object.assign(e,{trajectory_version:3,trajectory_age_now:20,path_ar:[[16,.4],[20,.8]],age_start:16,age_end:20,r_then:.4,r_now:.8}));");
click(t,'#nextBtn');assert.ok(t.doc.querySelector('[data-scale$="|autonomy"]'));assert.ok(!t.doc.querySelector('[data-detail-field$="|competition_level"]'));
change(t,'[data-detail-field$="|injury_related"]','true');assert.ok(t.doc.querySelector('[data-detail-field$="|injury_stop_days"]'));change(t,'[data-detail-field$="|injury_stop_days"]','0');click(t,'#nextBtn');assert.equal(t.w.buildPayload().events[0].details.injury_stop_days,0);assert.equal(t.w.buildPayload().process.n_events,1);assert.deepEqual(t.errors,[]);t.dom.window.close();

const legacy={step:4,profile:{age:'20',training_history:true,competition_history:false},events:[{id:'injury',label:'伤病影响训练或比赛',valence:-1,trajectory_version:3,trajectory_age_now:20,path_ar:[[12,-.7],[20,-.2]]}],details:{injury:{who:['家人'],closeness:.5}}};
const old=mount(legacy);assert.equal(old.run('state.step'),1);assert.equal(old.run('state.events[0].sports_relation'),'sports_unspecified');assert.equal(old.w.localStorage.getItem(KEY+'-before-v0.7'),JSON.stringify(legacy));assert.deepEqual(JSON.parse(old.run('JSON.stringify(state.events[0].path_ar)')),legacy.events[0].path_ar);
change(old,'#relation-injury','training');click(old,'#nextBtn');click(old,'#nextBtn');assert.equal(old.run('state.step'),3);
assert.equal(old.doc.querySelector('#injury-closeness').textContent,'未作答');
assert.equal(old.w.buildPayload().events[0].details.closeness,null);
input(old,'#rating-injury-closeness','0');assert.equal(old.w.buildPayload().events[0].details.closeness,0);
assert.equal(old.w.buildPayload().events[0].details_raw.rating_provenance.closeness,'self_report');
assert.deepEqual(old.errors,[]);old.dom.window.close();

const c=mount();background(c,false,true);
input(c,'#customPos','参加校运会');click(c,'[data-custom="1"]');
const customId=c.run('state.events[0].id');change(c,`#relation-${customId}`,'competition');
click(c,`[data-domain="${customId}"][value="个人成长"]`);click(c,'#nextBtn');assert.equal(c.run('state.step'),2);
c.run("state.events.forEach(e=>Object.assign(e,{trajectory_version:3,trajectory_age_now:20,path_ar:[[18,.6],[20,.3]]}));");
click(c,'#nextBtn');assert.equal(c.run('state.step'),3);
assert.equal(c.doc.querySelector('[data-detail-field$="|award_level"]'),null);
change(c,'[data-detail-field$="|competition_outcome"]','awarded');
assert.ok(c.doc.querySelector('[data-detail-field$="|award_level"]'));
const awardSelect=c.doc.querySelector('[data-detail-field$="|award_level"]');
change(c,'[data-detail-field$="|award_level"]',awardSelect.options[1].value);
click(c,'#nextBtn');assert.equal(c.run('state.step'),4);
assert.equal(c.w.buildPayload().events[0].details.competition_outcome,'awarded');
assert.ok(c.w.buildPayload().events[0].details.award_level);assert.deepEqual(c.errors,[]);c.dom.window.close();

// Exercise the demo's real inline script and the iframe handshake, without
// loading a browser, network resources or a WebGL renderer.
const demoHTML=fs.readFileSync(path.join(__dirname,'life-tree-3d-demo.html'),'utf8');
const demo=new JSDOM(demoHTML,{url:'https://example.test/questionnaire/prototype/life-tree-3d-demo.html',runScripts:'outside-only'});
const demoContext=demo.getInternalVMContext();
for(const match of demoHTML.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){
  const code=match[1]?fs.readFileSync(path.join(__dirname,match[1]),'utf8'):match[2];
  new vm.Script(code,{filename:match[1]||'demo-inline.js'}).runInContext(demoContext);
}
const demoBefore=vm.runInContext('JSON.stringify(events)',demoContext);
for(const [filter,count] of [['all',3],['general',1],['sports',2]]){
  demo.window.document.querySelector(`[data-filter="${filter}"]`).click();
  const frame=demo.window.document.querySelector('#tree iframe');assert.ok(frame);
  let message;frame.contentWindow.postMessage=data=>{message=data;};
  demo.window.dispatchEvent(new demo.window.MessageEvent('message',{origin:demo.window.location.origin,source:frame.contentWindow,data:{type:'sports-life-tree-ready'}}));
  assert.equal(message.payload.events.length,count);
  assert.equal(vm.runInContext('JSON.stringify(events)',demoContext),demoBefore);
  assert.equal(demo.window.localStorage.length,0);
}
demo.window.close();
console.log('PASS: actual app DOM flow for non-athletes, general/sports conditional questions, signed-path handoff, zero scores, no-event refusal, duplicate merging, read-only 2D/3D/domain filters and backed-up legacy migration (no browser rendering claim).');
