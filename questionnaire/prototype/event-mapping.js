(function(root){
  'use strict';
  const R=root.MentorReference||(typeof require==='function'?require('./mentor-reference.js'):null);
  const Tree=root.LifeTree||(typeof require==='function'?require('./life-tree.js'):null);
  const VERSION='mentor-f0-f20-v1';
  const numeric=(value,min=-Infinity,max=Infinity)=>value!==''&&value!=null&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
  const round=value=>Math.round(value*1000)/1000||0;
  const labels={F0_where_eco:'生态情境码',F1_centrality:'事件中心性',F2_control_w:'归因可控码',F3_who_tie:'关系纽带码',F4_closeness:'关键人物亲近／信任',F5_turn_w:'转折强度码',F6_ongoing:'未解决／持续',F7_mid_kind:'转折类型',F8_age_mid:'转折年龄',F9_r_mid:'转折时影响',F10_impact_delta:'影响变化',F11_obj_raw:'原条目参考权重',F12_obj_w:'参考权重归一化',F13_r_then:'起始影响',F14_r_now:'结束影响',F15_age_start:'起始年龄',F16_age_end:'结束年龄',F17_now_salience:'当前显著性',F18_theta:'展示角度（弧度）',F19_is_focal_now:'当前焦点事件',F20_delta_dir:'影响变化方向'};
  const groups=[
    {id:'centrality',title:'1 事件中心性',keys:['F1_centrality','F18_theta']},
    {id:'control',title:'2 归因与可控',keys:['F2_control_w']},
    {id:'interpersonal',title:'3 人际关系',keys:['F3_who_tie','F4_closeness']},
    {id:'turning',title:'4 转折与持续',keys:['F5_turn_w','F6_ongoing','F7_mid_kind','F8_age_mid','F9_r_mid','F10_impact_delta']},
    {id:'reference',title:'5 条目参考权重',keys:['F11_obj_raw','F12_obj_w']},
    {id:'trajectory',title:'6 影响轨迹与生活场景',keys:['F0_where_eco','F13_r_then','F14_r_now','F15_age_start','F16_age_end','F17_now_salience','F19_is_focal_now','F20_delta_dir']},
  ];
  function geometry(event,age){
    if(!Tree.isComplete(event,age))return null;
    const path=event.path_ar, first=path[0], last=path.at(-1);
    const sideThen=Math.sign(first[1]),sideNow=Math.sign(last[1])||sideThen;
    return {path,r_then:Math.abs(first[1]),r_now:Math.abs(last[1]),side_then:sideThen,side_now:sideNow,cross_axis:sideThen!==sideNow,
      age_start:numeric(event.age_start,0,age)??first[0],age_end:Object.hasOwn(event,'age_end')&&event.age_end==null?null:numeric(event.age_end,0,age)??last[0]};
  }
  function resolution(event,raw,age){
    const g=geometry(event,age);
    const crossHow=g?R.howFromPath({...g,valence:event.valence}):null;
    const how=crossHow||raw.how||null;
    const recognized=R.options[event.valence<0?'neg':'pos'].resolutions.includes(how);
    const info=recognized?R.midFromHow(how,event.valence):{mid_kind:null,need_mid:false};
    const lo=g?g.path[0][0]:0,hi=g?g.path.at(-1)[0]:age;
    const recordedAge=g?.cross_axis?numeric(event.age_cross,lo,hi):null;
    const recordedR=g?.cross_axis?numeric(event.r_cross,0,1):null;
    const originalCross=event.cross_axis===true&&recordedAge!=null&&recordedR!=null;
    const crossing=originalCross?[recordedAge,recordedR]:g?.cross_axis?g.path.find(point=>Math.sign(point[1])===g.side_now):null;
    const crossingSource=originalCross?'original_crossing_sample':'path_crossing';
    const userAge=info.need_mid?numeric(raw.age_mid,lo,hi):null;
    const userR=info.need_mid?numeric(raw.r_mid,0,1):null;
    return {how,recognized,source:crossHow?'path_crossing_rule':how?'self_report':'unanswered',mid_kind:info.mid_kind,need_mid:info.need_mid,lo,hi,
      age_mid:info.need_mid?(userAge??(crossing?crossing[0]:null)):null,
      r_mid:info.need_mid?(userR??(crossing?Math.abs(crossing[1]):null)):null,
      age_mid_source:!info.need_mid?'not_applicable':userAge!=null?'self_report':crossing?crossingSource:'unanswered',
      r_mid_source:!info.need_mid?'not_applicable':userR!=null?'self_report':crossing?crossingSource:'unanswered'};
  }
  function referenceFor(event){
    const direct=R.items[event.base_event_id||event.id];
    const ids=(event.source_catalog_ids||[]).filter(id=>R.items[id]);
    const chosen=ids.length>1?null:direct||(ids.length===1?R.items[ids[0]]:null);
    return chosen?{raw:chosen.obj_raw,weight:chosen.obj_w,status:'mentor_item_reference',item:chosen.t}
      :{raw:null,weight:null,status:ids.length>1?'ambiguous_merged_references':event.custom?'custom_no_reference':'no_mentor_item_reference',item:null};
  }
  function derive(event,raw={},age=20){
    const g=geometry(event,age), h=resolution(event,raw,age), ref=referenceFor(event);
    const who=Array.isArray(raw.who)?raw.who:raw.who?[raw.who]:[];
    const primary=who.length===1?who[0]:who.includes(raw.who_primary)?raw.who_primary:null;
    const relationBasis=primary?(R.who.includes(primary)?primary:R.who.includes(raw.who_tie_basis)?raw.who_tie_basis:null):null;
    const whereBasis=R.where.includes(raw.where)?raw.where:R.where.includes(raw.where_basis)?raw.where_basis:null;
    const causes=R.options[event.valence<0?'neg':'pos'].causes;
    const whyBasis=causes.includes(raw.why)?raw.why:causes.includes(raw.why_basis)?raw.why_basis:null;
    const centrality=numeric(event.centrality,0,1),salience=numeric(event.now_salience,0,1);
    const closeness=primary&&!['自己','说不清'].includes(primary)&&raw.rating_provenance?.closeness!=='legacy_unverified'?numeric(raw.closeness,0,1):null;
    const delta=g?R.deltaFromR(g.r_then,g.r_now):null;
    const thetaSource=centrality!=null?'self_report_centrality':ref.weight!=null?'mentor_item_reference':'display_default_only';
    const theta=thetaSource==='display_default_only'?null:round(R.thetaFromWeight(event.valence,centrality??ref.weight));
    const f={F0_where_eco:whereBasis?R.whereEco(whereBasis):null,F1_centrality:centrality,F2_control_w:whyBasis?R.controlFromWhy(whyBasis,event.valence):null,
      F3_who_tie:relationBasis?R.whoTie(relationBasis):null,F4_closeness:closeness,F5_turn_w:h.recognized?R.turnFromHow(h.how,event.valence):null,
      F6_ongoing:h.recognized?R.ongoingFromHow(h.how,event.valence):null,F7_mid_kind:h.mid_kind,F8_age_mid:h.age_mid,F9_r_mid:h.r_mid,
      F10_impact_delta:delta?.impact_delta??null,F11_obj_raw:ref.raw,F12_obj_w:ref.weight,F13_r_then:g?.r_then??null,F14_r_now:g?.r_now??null,
      F15_age_start:g?.age_start??null,F16_age_end:g?.age_end??null,F17_now_salience:salience,F18_theta:theta,F19_is_focal_now:salience==null?null:salience>=.7,F20_delta_dir:delta?.delta_dir??null};
    const sources={where_basis:whereBasis,who_primary:primary,who_tie_basis:relationBasis,why_basis:whyBasis,how:h.source,
      age_mid:h.age_mid_source,r_mid:h.r_mid_source,theta:thetaSource,reference:ref.status,reference_item:ref.item};
    const missing=Object.keys(f).filter(key=>f[key]==null);
    return {version:VERSION,fields:f,sources,missing_fields:missing,how:h.how};
  }
  function flatten(event,raw={},age=20){
    const mapping=derive(event,raw,age),f=mapping.fields;
    return {...event,where:raw.where??null,who:Array.isArray(raw.who)?raw.who.join('、'):raw.who??null,why:raw.why??null,how:mapping.how,
      ...Object.fromEntries(Object.entries(f).map(([key,value])=>[key.replace(/^F\d+_/,''),value])),mapping};
  }
  const api={VERSION,derive,flatten,resolution,referenceFor,labels,groups};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EventMapping=api;
})(typeof window!=='undefined'?window:globalThis);
