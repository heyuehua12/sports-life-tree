// Additional visual encodings for the mentor viewer. Original paths stay intact.
const unit=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:null;
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const show=value=>String(Math.round(value*100)/100);
const sample=(path,fraction)=>{
  const age=path[0][0]+(path.at(-1)[0]-path[0][0])*fraction;
  for(let i=1;i<path.length;i++)if(path[i][0]>=age){
    const a=path[i-1],b=path[i],t=b[0]===a[0]?0:(age-a[0])/(b[0]-a[0]);
    return [age,Math.abs(a[1])+(Math.abs(b[1])-Math.abs(a[1]))*t];
  }
  return [path.at(-1)[0],Math.abs(path.at(-1)[1])];
};

export function mappingSpec(event,fields) {
  const path=event.path_ar;
  if(!Array.isArray(path)||path.length<2||!path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return [];
  const start=[path[0][0],Math.abs(path[0][1])],end=[path.at(-1)[0],Math.abs(path.at(-1)[1])];
  const f=fields,markers=[];
  const add=(kind,anchor,label,values={})=>markers.push({kind,anchor,label,...values});
  if(number(f.F18_theta)!=null){
    const central=unit(f.F1_centrality);
    add('centrality',start,central==null?'① 角度来自条目参考（中心性未答）':`① 中心性 ${show(central*10)}/10 · ${show(Math.abs(f.F18_theta)*180/Math.PI)}°`,{theta:f.F18_theta,value:central});
  }
  if(unit(f.F2_control_w)!=null)add('control',sample(path,.28),`② 归因可控码 ${show(f.F2_control_w)}`,{value:f.F2_control_w});
  const tie=unit(f.F3_who_tie),close=unit(f.F4_closeness);
  if(tie!=null||close!=null)add('relationships',sample(path,.56),`③ 关系码 ${tie==null?'未答':show(tie)} · 亲疏 ${close==null?'未答':show(close)}`,{tie,close});
  const age=number(f.F8_age_mid),impact=unit(f.F9_r_mid),turn=unit(f.F5_turn_w),ongoing=typeof f.F6_ongoing==='boolean'?f.F6_ongoing:null;
  if(age!=null&&impact!=null&&age>=start[0]&&age<=end[0]){
    const t=end[0]===start[0]?0:(age-start[0])/(end[0]-start[0]);
    add('turning',[age,impact],`④ 转折 ${show(age)} 岁 · ${ongoing==null?'持续性未答':ongoing?'仍持续':'非持续'}`,{value:turn,mid:true,ongoing,connector:sample(path,t),end});
  }else if(turn!=null||ongoing!=null){
    add('turning',end,`④ 变化码 ${turn==null?'未答':show(turn)} · ${ongoing==null?'持续性未答':ongoing?'仍持续':'非持续'}`,{value:turn,mid:false,ongoing});
  }
  const weight=unit(f.F12_obj_w),raw=number(f.F11_obj_raw);
  if(weight!=null&&raw!=null)add('reference',start,`⑤ 条目参考 ${show(raw)}/180`,{value:weight,raw});
  const salience=unit(f.F17_now_salience);
  if(salience!=null)add('salience',end,`⑥ 当前影响 ${show(salience*10)}/10${f.F19_is_focal_now===true?' · 焦点':''}`,{value:salience,focal:f.F19_is_focal_now===true});
  const eco=unit(f.F0_where_eco);
  if(eco!=null)add('ecology',start,`地点 ${event.where||'已答'} · 生态码 ${show(eco)}`,{value:eco});
  return markers;
}

export function createMappingLayer({THREE,scene,host,camera,pointFor,registerPickable,invalidate=()=>{},onDetails=()=>{}}) {
  const doc=host.ownerDocument;
  const group=new THREE.Group();group.name='questionnaire-dimension-mappings';scene.add(group);
  const overlay=doc.createElement('div');overlay.className='scene-mapping-overlay';
  const toolbar=doc.createElement('div');toolbar.className='scene-mapping-toolbar';
  const makeButton=(label,handler)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',handler);toolbar.appendChild(b);return b;};
  let enabled=true,scope='all',focus=null,entries=[],billboards=[],eventCount=0,scopeChosen=false;
  const toggle=makeButton('映射：开',()=>{enabled=!enabled;refresh();});
  const scopeButton=makeButton('标记：全部',()=>{scopeChosen=true;scope=scope==='all'?'selected':'all';refresh();});
  makeButton('字段详情',()=>onDetails(focus));
  const legend=doc.createElement('div');legend.className='scene-mapping-legend';legend.setAttribute('aria-label','三维图形映射图例');
  legend.textContent='① 扇角＝中心性　② 环弧＝可控码　③ 内／外环＝关系码／亲疏　④ 菱形＝转折，大小＝变化码；虚线框＝仍持续，实线框＝非持续　⑤ 底座环大小＝条目参考　⑥ 末端光环大小＝当前影响；双环＝焦点　六角标＝地点';
  const status=doc.createElement('div');status.className='scene-mapping-status';status.setAttribute('role','status');
  const wires=doc.createElementNS('http://www.w3.org/2000/svg','svg');wires.classList.add('scene-mapping-wires');wires.setAttribute('aria-hidden','true');
  const labels=doc.createElement('div');labels.className='scene-mapping-labels';
  overlay.append(wires,labels,toolbar,status,legend);host.appendChild(overlay);
  const colors={centrality:0xc4d8ef,control:0x90c9d2,relationships:0xe4bf96,turning:0xf1e0b5,reference:0xacb7cd,salience:0xd9e9df,ecology:0xb1c8bb};
  function material(color,opacity=1){return new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:false});}
  function ring(parent,radius,value,color,segments=36){
    const base=new THREE.Mesh(new THREE.RingGeometry(radius-.012,radius+.012,segments),material(color,.25));parent.add(base);
    // A zero is an empty ring, not a missing or half-filled response.
    if(value>0){const fill=new THREE.Mesh(new THREE.RingGeometry(radius-.027,radius+.027,segments,1,Math.PI/2,Math.PI*2*value),material(color));parent.add(fill);}
  }
  function stroke(parent,points,color,dashed=false){
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.065,gapSize:.04}):new THREE.LineBasicMaterial({color});
    const line=new THREE.Line(geo,mat);if(dashed)line.computeLineDistances();parent.add(line);return line;
  }
  function tag(entry){entry.object.traverse(obj=>{if(obj.isMesh)registerPickable(obj,entry.id);});}
  function onPath(event,age,theta,ageLo,ageHi,trunkH){
    const path=event.path_ar;
    for(let i=1;i<path.length;i++)if(path[i][0]>=age){
      const a=path[i-1],b=path[i],t=b[0]===a[0]?0:(age-a[0])/(b[0]-a[0]);
      const start=pointFor(Math.abs(a[1]),theta,a[0],ageLo,ageHi,trunkH),end=pointFor(Math.abs(b[1]),theta,b[0],ageLo,ageHi,trunkH);
      return start.lerp(end,Math.max(0,Math.min(1,t)));
    }
    return pointFor(Math.abs(path.at(-1)[1]),theta,path.at(-1)[0],ageLo,ageHi,trunkH);
  }
  function build(events,derive,ageLo,ageHi,trunkH,ageNow){
    clear();eventCount=events.length;
    if(!scopeChosen)scope=events.length>6?'selected':'all';
    if(!events.some(e=>String(e.event_id)===String(focus)))focus=events[0]?.event_id??null;
    events.forEach((event,index)=>{
      const fields=derive(event),spec=mappingSpec(event,fields);
      for(const marker of spec){
        const id=event.event_id,object=new THREE.Group();object.name=`mapping-${marker.kind}-${id}`;
        object.userData={kind:marker.kind,eventId:id,value:marker.value??null};group.add(object);
        const theta=eventThetaFor(event,fields);
        const origin=marker.kind==='turning'&&marker.mid?pointFor(marker.anchor[1],theta,marker.anchor[0],ageLo,ageHi,trunkH):onPath(event,marker.anchor[0],theta,ageLo,ageHi,trunkH);
        object.position.copy(origin);
        const entry={...marker,id,index,object,anchor:object.position,color:colors[marker.kind]};entries.push(entry);
        const billboard=()=>{billboards.push(object);};
        if(marker.kind==='centrality'){
          object.position.set(0,.16+index*.012,0);
          // theta follows the original event layout; floor arcs never change a path.
          const points=[],steps=Math.max(1,Math.ceil(Math.abs(marker.theta)*22)),radius=1.05;
          for(let i=0;i<=steps;i++){const a=marker.theta*i/steps;points.push(new THREE.Vector3(radius*Math.cos(a),0,-radius*Math.sin(a)));}
          stroke(object,points,entry.color);
          const end=points.at(-1),tick=stroke(object,[end.clone().multiplyScalar(.92),end.clone().multiplyScalar(1.08)],entry.color);tick.userData.kind='angle-tick';
          entry.anchor=object.position.clone().add(points[Math.floor(steps/2)]);
        }else if(marker.kind==='control'){
          ring(object,.26,marker.value,entry.color);billboard();
        }else if(marker.kind==='relationships'){
          if(marker.tie!=null)ring(object,.21,marker.tie,entry.color);
          if(marker.close!=null)ring(object,.34,marker.close,entry.color);
          billboard();
        }else if(marker.kind==='turning'){
          if(marker.mid){
            const r=.13+.12*(marker.value??0);
            const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(r),material(entry.color));object.add(diamond);
            const actual=onPath(event,marker.connector[0],theta,ageLo,ageHi,trunkH);
            stroke(object,[new THREE.Vector3(),actual.sub(origin)],entry.color,true);
          }
          if(!marker.mid||marker.ongoing!=null){
            const state=new THREE.Group();object.add(state);
            if(marker.mid)state.position.copy(onPath(event,marker.end[0],theta,ageLo,ageHi,trunkH)).sub(origin);
            const r=.57+.08*(marker.value??0);
            const frame=stroke(state,[[-r,-r],[r,-r],[r,r],[-r,r],[-r,-r]].map(([x,y])=>new THREE.Vector3(x,y,0)),entry.color,marker.ongoing===true);
            if(marker.ongoing==null){frame.material.transparent=true;frame.material.opacity=.3;}
            billboards.push(state);
          }
        }else if(marker.kind==='reference'){
          object.position.y=.13+index*.004;
          ring(object,.14+.32*marker.value,1,entry.color);object.rotation.x=-Math.PI/2;
        }else if(marker.kind==='salience'){
          const radius=.19+.30*marker.value;
          ring(object,radius,1,entry.color);
          if(marker.focal)ring(object,radius+.08,1,entry.color);
          billboard();
        }else if(marker.kind==='ecology'){
          const hex=Array.from({length:7},(_,i)=>new THREE.Vector3(.19*Math.cos(i*Math.PI/3),.19*Math.sin(i*Math.PI/3),0));stroke(object,hex,entry.color);billboard();
        }
        tag(entry);
        const label=doc.createElement('span');label.className='scene-mapping-callout';label.textContent=marker.label;label.title=marker.label;
        label.dataset.kind=marker.kind;label.style.borderColor='#'+entry.color.toString(16).padStart(6,'0');labels.appendChild(label);entry.labelElement=label;
        const wire=doc.createElementNS('http://www.w3.org/2000/svg','path');wire.setAttribute('stroke','#'+entry.color.toString(16).padStart(6,'0'));wires.appendChild(wire);entry.wire=wire;
      }
    });
    refresh();
  }
  function eventThetaFor(event,fields){
    if(unit(fields.F1_centrality)!=null)return (event.valence>=0?1:-1)*fields.F1_centrality*Math.PI;
    if(number(fields.F18_theta)!=null)return fields.F18_theta;
    return (event.valence>=0?1:-1)*Math.PI/2;
  }
  function refresh(){
    group.visible=enabled;labels.hidden=!enabled;wires.style.display=enabled?'':'none';legend.hidden=!enabled;
    toggle.textContent=`映射：${enabled?'开':'关'}`;toggle.setAttribute('aria-pressed',String(enabled));
    scopeButton.textContent=scope==='all'?'标记：全部':'标记：选中';scopeButton.setAttribute('aria-pressed',String(scope==='selected'));scopeButton.disabled=!enabled;
    const visible=entries.filter(entry=>String(entry.id)===String(focus));
    const count=new Set(visible.map(e=>e.kind==='ecology'?'salience':e.kind)).size;
    status.textContent=enabled?`经历 ${(visible[0]?.index??0)+1}/${eventCount} · 已绘制 ${count}/6 类映射 · 空项不画默认值`:'已隐藏附加映射，保留原版生命树';
    for(const entry of entries){
      const selected=String(entry.id)===String(focus);
      // Only the selected angular arc is shown, so shared floor arcs do not pile up.
      entry.object.visible=enabled&&(scope==='all'||selected)&&(entry.kind!=='centrality'||selected);
      entry.labelElement.hidden=!enabled||!selected;entry.wire.style.display=!enabled||!selected?'none':'';
    }
    update();invalidate();
  }
  function update(){
    if(!enabled)return;
    for(const object of billboards)object.quaternion.copy(camera.quaternion);
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    const labelWidth=Math.min(204,Math.max(120,w*.29));
    const sides=[[],[]],top=Math.max(76,toolbar.offsetHeight+30),bottom=Math.max(top+26,h-(legend.offsetHeight||64)-30);
    for(const entry of entries){
      if(String(entry.id)!==String(focus)||!entry.object.visible){entry.labelElement.hidden=true;entry.wire.style.display='none';continue;}
      const p=entry.anchor.clone().project(camera);
      if(p.z < -1||p.z>1||Math.abs(p.x)>1.08||Math.abs(p.y)>1.08){entry.labelElement.hidden=true;entry.wire.style.display='none';continue;}
      const x=(p.x+1)*w/2,y=(1-p.y)*h/2;
      sides[x<w/2?0:1].push({entry,x,y,desired:Math.max(top,Math.min(bottom,y))});
    }
    sides.forEach((items,side)=>{
      items.sort((a,b)=>a.desired-b.desired);
      const gap=Math.min(37,(bottom-top)/Math.max(1,items.length-1));let previous=top-gap;
      const positions=items.map(item=>{const y=Math.max(item.desired,previous+gap);previous=y;return y;});
      if(positions.length)positions[positions.length-1]=Math.min(bottom,positions.at(-1));
      for(let i=positions.length-2;i>=0;i--)positions[i]=Math.min(positions[i],positions[i+1]-gap);
      items.forEach((item,i)=>{
        const {entry,x,y}=item,ly=positions[i],lx=side===0?8:w-labelWidth-8;
        entry.labelElement.hidden=false;entry.labelElement.style.width=labelWidth+'px';entry.labelElement.style.transform=`translate(${lx}px,${ly-13}px)`;
        const edge=side===0?lx+labelWidth:lx,elbow=side===0?edge+9:edge-9;
        entry.wire.style.display='';entry.wire.setAttribute('d',`M ${x.toFixed(1)} ${y.toFixed(1)} L ${elbow.toFixed(1)} ${ly.toFixed(1)} L ${edge.toFixed(1)} ${ly.toFixed(1)}`);
      });
    });
  }
  function select(id){if(entries.some(e=>String(e.id)===String(id)))focus=id;refresh();}
  function clear(){
    group.traverse(obj=>{obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();});
    group.clear();entries=[];billboards=[];labels.replaceChildren();wires.replaceChildren();
  }
  return {group,build,select,update,clear,setEnabled(value){enabled=!!value;refresh();},setScope(value){scopeChosen=true;scope=value==='selected'?'selected':'all';refresh();},get entries(){return entries;},get state(){return {enabled,scope,focus};}};
}
