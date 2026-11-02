const assert=require('node:assert/strict');
const M=require('./event-mapping.js'),R=require('./mentor-reference.js'),H=require('./life-history-model.js');
const catalog=require('./life-event-catalog.js');
const make=(valence=1)=>({id:'custom-test',custom:true,valence,trajectory_version:3,trajectory_age_now:20,path_ar:[[12,valence*.8],[16,valence*.5],[20,valence*.2]],centrality:null,now_salience:null,obj_raw:90,obj_w:.5,theta:1.57});
for(const item of catalog){
  const e={...make(item.valence),...item};delete e.custom;
  const mapping=M.derive(e,{},20);
  assert.equal(mapping.fields.F11_obj_raw,R.items[item.id].obj_raw);
  assert.equal(mapping.fields.F12_obj_w,R.items[item.id].obj_w);
  assert.equal(mapping.sources.theta,'mentor_item_reference');
}
for(const valence of [-1,1]){
  const e=make(valence),opts=R.options[valence<0?'neg':'pos'];
  for(const where of R.where)assert.equal(M.derive(e,{where},20).fields.F0_where_eco,R.whereEco(where));
  for(const person of R.who)assert.equal(M.derive(e,{who:[person]},20).fields.F3_who_tie,R.whoTie(person));
  for(const why of opts.causes)assert.equal(M.derive(e,{why},20).fields.F2_control_w,R.controlFromWhy(why,valence));
  for(const how of opts.resolutions){
    const m=M.derive(e,{how},20);
    assert.equal(m.fields.F5_turn_w,R.turnFromHow(how,valence));assert.equal(m.fields.F6_ongoing,R.ongoingFromHow(how,valence));
    assert.equal(m.fields.F7_mid_kind,R.midFromHow(how,valence).mid_kind);
  }
}
const e=make(),missing=M.derive(e,{},20);
assert.equal(missing.fields.F11_obj_raw,null);assert.equal(missing.fields.F12_obj_w,null);assert.equal(missing.fields.F18_theta,null);
assert.equal(missing.fields.F19_is_focal_now,null);assert.equal(missing.fields.F8_age_mid,null);
const zero=M.derive({...e,centrality:0,now_salience:0},{who:['家人'],closeness:0},20);
assert.equal(zero.fields.F18_theta,0);assert.equal(zero.fields.F19_is_focal_now,false);assert.equal(zero.fields.F4_closeness,0);
assert.equal(M.derive({...e,now_salience:.7},{},20).fields.F19_is_focal_now,true);
assert.equal(M.derive(e,{who:['家人'],closeness:.5,rating_provenance:{closeness:'legacy_unverified'}},20).fields.F4_closeness,null);
const sports={where:'训练场',who:['主教练','队友'],why:'自己的训练或表现',closeness:.7};
const unclassified=M.derive(e,sports,20);
for(const key of ['F0_where_eco','F2_control_w','F3_who_tie','F4_closeness'])assert.equal(unclassified.fields[key],null);
const completed=M.derive(e,{...sports,where_basis:'学校',who_primary:'主教练',who_tie_basis:'老师',why_basis:'自己努力'},20);
assert.equal(completed.fields.F0_where_eco,R.whereEco('学校'));assert.equal(completed.fields.F3_who_tie,R.whoTie('老师'));
assert.equal(completed.fields.F2_control_w,R.controlFromWhy('自己努力',1));assert.equal(completed.fields.F4_closeness,.7);
assert.equal(M.derive(e,{where:'家庭或宿舍',why:'自己的努力或选择',how:'持续变好'},20).fields.F0_where_eco,null,'ambiguous old answers are not guessed');
const cross={...make(-1),path_ar:[[12,-.8],[16,-.1],[17,.12],[20,.6]]};
const crossed=M.derive(cross,{how:'至今没解决'},20);
assert.equal(crossed.how,'后来变好了');assert.equal(crossed.sources.how,'path_crossing_rule');
assert.equal(crossed.fields.F8_age_mid,17);assert.equal(crossed.fields.F9_r_mid,.12);assert.equal(crossed.sources.age_mid,'path_crossing');
const originalCross=M.derive({...cross,cross_axis:true,age_cross:16.5,r_cross:.05},{},20);
assert.equal(originalCross.fields.F8_age_mid,16.5);assert.equal(originalCross.fields.F9_r_mid,.05);assert.equal(originalCross.sources.age_mid,'original_crossing_sample');
const manual=M.derive(cross,{age_mid:18,r_mid:0},20);assert.equal(manual.fields.F8_age_mid,18);assert.equal(manual.fields.F9_r_mid,0);assert.equal(manual.sources.r_mid,'self_report');
const noCross=M.derive(e,{how:'成了后来好事的起点'},20);assert.equal(noCross.fields.F8_age_mid,null);assert.equal(noCross.fields.F9_r_mid,null);
assert.equal(M.derive(e,{how:'成了后来好事的起点',age_mid:11,r_mid:2},20).fields.F8_age_mid,null);
const repeated={...e,id:'repeat-1',base_event_id:'mentor_pos_05',source_catalog_ids:['mentor_pos_05']};assert.equal(M.referenceFor(repeated).raw,R.items.mentor_pos_05.obj_raw);
assert.equal(M.referenceFor({...repeated,source_catalog_ids:['mentor_pos_05','mentor_pos_06']}).raw,null);
const original=JSON.stringify(cross);M.flatten(cross,sports,20);assert.equal(JSON.stringify(cross),original,'mapping does not mutate raw paths or records');
assert.equal(M.derive({...e,trajectory_age_now:19},{},20).fields.F13_r_then,null);
assert.equal(M.flatten({...e,age_end:null},{},20).age_end,null,'explicit original open end is preserved');
const old={schema_version:'sports-life-tree-prototype-v0.8',events:[e],details:{[e.id]:{who:['家人'],closeness:.8}}};H.normalize(old);
assert.equal(H.detailsForExport(e,old.details[e.id]).closeness,.8,'v0.8 self-reports remain valid after migration');
assert.equal(Object.values(M.groups).flatMap(group=>group.keys).length,21);
console.log('PASS: F0–F20 match original dictionaries; real item references only; explicit sports correspondence, primary person, cross-axis sources, conditional midpoints, zero/false/null and v0.8 migration.');
