const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require('jsdom');
const M=require('./event-mapping.js');
(async()=>{
  const {mappingSpec,createMappingLayer}=await import(pathToFileURL(path.join(__dirname,'mapping-scene.mjs')));
  const THREE=await import(pathToFileURL(path.join(__dirname,'vendor/three/three.module.js')));
  const source=fs.readFileSync(path.join(__dirname,'mentor-3d/index.html'),'utf8');
  const context=vm.createContext({THREE,viewMode:'stereo',R_SCALE:4.8});
  for(const name of ['radiusFromR','polarXZ','ageToY','eventTheta','polarToThree']){
    const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);
    new vm.Script(source.slice(start,end)).runInContext(context);
  }
  const event={id:'mentor_neg_01',event_id:'mentor_neg_01',valence:-1,trajectory_version:3,trajectory_age_now:20,path_ar:[[12,-.8],[16,-.4],[18,-.1],[19,.12],[20,.3]],age_start:12,age_end:20,centrality:.7,now_salience:.8};
  const raw={where:'学校',who:['家人'],why:'自己行为',closeness:.85};
  const mapped={...M.flatten(event,raw,20),event_id:event.id};
  const missing={...M.flatten({...event,id:'custom-empty',event_id:'custom-empty',custom:true,centrality:null,now_salience:null},{},20),event_id:'custom-empty'};
  const specs=mappingSpec(mapped,mapped.mapping.fields);
  assert.deepEqual(specs.map(s=>s.kind),['centrality','control','relationships','turning','reference','salience','ecology']);
  assert.equal(specs.find(s=>s.kind==='turning').mid,true);assert.equal(specs.find(s=>s.kind==='turning').anchor[0],19);
  assert.equal(mappingSpec(missing,missing.mapping.fields).some(s=>['reference','centrality','control','relationships','salience','ecology'].includes(s.kind)),false);
  const zero={...mapped.mapping.fields,F1_centrality:0,F18_theta:0,F2_control_w:0,F3_who_tie:0,F4_closeness:0,F17_now_salience:0,F19_is_focal_now:false,F11_obj_raw:0,F12_obj_w:0};
  const zeros=mappingSpec(mapped,zero);for(const kind of ['centrality','control','relationships','reference','salience'])assert.ok(zeros.some(s=>s.kind===kind),'zero remains visible: '+kind);
  assert.deepEqual(mappingSpec({...mapped,path_ar:null},mapped.mapping.fields),[]);
  const dom=new JSDOM('<div id="host"></div>'),host=dom.window.document.querySelector('#host');let width=900,height=600;
  Object.defineProperty(host,'clientWidth',{get:()=>width});Object.defineProperty(host,'clientHeight',{get:()=>height});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,width/height,.1,200);camera.position.set(12,7,10);camera.lookAt(0,4,0);camera.updateMatrixWorld();
  const picks=[];let invalidations=0,detailsId=null;
  const layer=createMappingLayer({THREE,scene,host,camera,pointFor:context.polarToThree,registerPickable:(obj,id)=>{obj.userData.eventId=id;picks.push(obj);},invalidate:()=>{invalidations++;},onDetails:id=>{detailsId=id;}});
  const before=JSON.stringify([mapped,missing]);layer.build([mapped,missing],e=>e.mapping.fields,12,21,8,20);
  assert.equal(JSON.stringify([mapped,missing]),before,'the display does not rewrite paths, scores or mappings');
  assert.ok(picks.length>0);assert.equal(layer.group.parent,scene);
  for(const entry of layer.entries){assert.ok(entry.object.position.toArray().every(Number.isFinite));entry.object.traverse(obj=>{if(obj.geometry){const coords=obj.geometry.attributes.position?.array;if(coords)assert.ok([...coords].every(Number.isFinite),'finite geometry for '+entry.kind);}});}
  const diamond=layer.entries.find(e=>e.kind==='turning'&&e.id===mapped.id);
  const expected=context.polarToThree(.12,context.eventTheta(mapped),19,12,21,8);
  assert.ok(diamond.object.position.distanceTo(expected)<1e-8,'the diamond uses actual turning age/impact in original polar geometry');
  const control=layer.entries.find(e=>e.kind==='control');
  assert.ok(control.object.children.some(c=>c.geometry?.parameters.thetaLength===2*Math.PI*control.value),'control arc length is the recorded dictionary code');
  const relationship=layer.entries.find(e=>e.kind==='relationships');
  assert.ok(relationship.object.children.some(c=>c.geometry?.parameters.thetaLength===2*Math.PI*.85),'outer relationship arc uses the real closeness answer');
  const reference=layer.entries.find(e=>e.kind==='reference');assert.equal(reference.object.position.y,.13);assert.equal(reference.object.children[0].geometry.parameters.innerRadius,.14+.32*reference.value-.012);
  const salience=layer.entries.find(e=>e.kind==='salience');assert.equal(salience.object.children.length,4,'focal event has two halo rings');
  layer.select(missing.id);layer.setScope('selected');
  assert.ok(layer.entries.filter(e=>e.id===mapped.id).every(e=>!e.object.visible));assert.equal(layer.state.focus,missing.id);
  assert.ok([...host.querySelectorAll('.scene-mapping-callout')].filter(e=>!e.hidden).every(e=>e.dataset.kind==='turning'));
  layer.select(mapped.id);layer.update();
  host.querySelectorAll('.scene-mapping-toolbar button')[2].click();assert.equal(detailsId,mapped.id);
  for(const size of [[900,600],[390,480]]){
    [width,height]=size;camera.aspect=width/height;camera.updateProjectionMatrix();layer.update();
    const labels=[...host.querySelectorAll('.scene-mapping-callout')].filter(e=>!e.hidden);
    for(const el of labels){assert.ok(el.style.transform.startsWith('translate('));const [x,y]=el.style.transform.match(/-?[\d.]+/g).map(Number);assert.ok(x>=0&&y>=0&&x+parseFloat(el.style.width)<=width,'label stays within viewport');}
  }
  layer.setEnabled(false);assert.equal(layer.group.visible,false);assert.ok(host.querySelector('.scene-mapping-labels').hidden);
  host.querySelector('.scene-mapping-toolbar button').click();assert.equal(layer.group.visible,true);assert.ok(invalidations>0);
  let disposed=0;layer.group.traverse(obj=>obj.geometry?.addEventListener('dispose',()=>disposed++));layer.clear();
  assert.equal(layer.group.children.length,0);assert.equal(host.querySelectorAll('.scene-mapping-callout').length,0);assert.ok(disposed>0);
  layer.build([mapped],e=>e.mapping.fields,12,21,8,20);assert.equal(layer.entries.length,7,'redraw recreates one glyph set without accumulation');
  layer.clear();dom.window.close();
  // Execute the generated viewer bridge with real Three.js scene objects.
  // Canvas painting and OrbitControls are stubbed: this is not a browser/WebGL test.
  const full=new JSDOM(source,{url:'https://example.test/mentor-3d/index.html?embedded=1',runScripts:'outside-only'}),w=full.window;
  const sceneHost=w.document.querySelector('#c');Object.defineProperty(sceneHost,'clientWidth',{value:900});Object.defineProperty(sceneHost,'clientHeight',{value:600});
  const messages=[];w.postMessage=data=>messages.push(data);w.requestAnimationFrame=()=>1;
  w.HTMLCanvasElement.prototype.getContext=function(type){return type==='2d'?{clearRect(){},fillText(){}}:null;};
  w.THREE=THREE;w.createMappingLayer=createMappingLayer;
  w.ResizeObserver=class{observe(){}};
  w.SVGRenderer=class{constructor(){this.domElement=w.document.createElementNS('http://www.w3.org/2000/svg','svg');}setQuality(){}setSize(){}render(){this.domElement.replaceChildren();}};
  w.OrbitControls=class{constructor(cam){this.camera=cam;this.target=new THREE.Vector3();}update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld();}};
  const viewerContext=full.getInternalVMContext();
  const code=source.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm,'');
  new vm.Script(code,{filename:'generated-viewer-runtime.js'}).runInContext(viewerContext);
  w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w,data:{type:'sports-life-tree-data',payload:{events:[mapped],age_now:20}}}));
  assert.ok(messages.some(m=>m.type==='sports-life-tree-rendered'&&m.count===1));assert.ok(!messages.some(m=>m.type==='sports-life-tree-error'));
  assert.equal(vm.runInContext('mappingLayer.entries.length',viewerContext),7);
  w.document.querySelector('#event-chips button').click();assert.ok(!w.document.querySelector('#anno').classList.contains('open'),'clicking the trajectory keeps the graph visible');
  w.document.querySelectorAll('.scene-mapping-toolbar button')[2].click();assert.ok(w.document.querySelector('#anno').classList.contains('open'),'details drawer opens only when requested');
  w.document.querySelector('#btn-view-2d').click();assert.equal(vm.runInContext('mappingLayer.entries.length',viewerContext),7);vm.runInContext('loop()',viewerContext);
  full.window.close();
  console.log('PASS: actual Three.js mapping geometry, seven glyph types for six constructs, original coordinates, null/zero distinctions, reference/relationship/halo encoding, selection/toggles, label bounds and resource cleanup (no browser rendering claim).');
})().catch(error=>{console.error(error);process.exitCode=1;});
