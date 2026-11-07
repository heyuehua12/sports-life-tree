(function (root) {
  'use strict';
  // Map original questionnaire responses before transporting them to the viewer.
  function payloadFor(events, details, age) {
    return {
      age_now: age, tool_version: 'sports-life-tree-prototype-v0.9.1',
      events: events.filter(e => root.LifeTree.isComplete(e, age)).map(e => {
        const d = details[e.id] || {};
        return { ...root.EventMapping.flatten(e,d,age), event_id:e.id, item_key:e.label, details_raw:d };
      }),
    };
  }
  let stopPrevious = () => {};
  function dispose() { stopPrevious(); stopPrevious = () => {}; }
  function render({ host, events, details = {}, age = 20, filter = 'all' }) {
    dispose();
    const filtered = root.LifeHistory ? events.filter(e => root.LifeHistory.matchesFilter(e, filter)) : events;
    const payload = payloadFor(filtered, details, age);
    host.replaceChildren();
    if (!payload.events.length) {
      host.textContent = '当前范围没有已完成的轨迹，可切换“全部”或返回完成绘图。';
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.className = 'life-tree-3d-frame'; iframe.title = '生命树三维结果查看器';
    iframe.src = 'mentor-3d/index.html?embedded=1';
    const status = document.createElement('p');
    status.className = 'three-d-status'; status.setAttribute('role', 'status');
    status.textContent = '正在载入三维轨迹…';
    const missing = payload.events.filter(e => e.centrality == null).length;
    const note = document.createElement('p'); note.className = 'three-d-note';
    note.textContent = '图中附加环弧、双环、转折标记、底座环和当前影响光环；左上角可开关标记、切换全部／选中经历。未出现的维度可返回第四步补答，体育新增事件没有原版参考权重时不画底座环。角度优先用中心性，未评分时用原版条目参考权重；两项均缺失时只按半区中线展示。' + (missing ? `${missing} 件经历尚未评中心性。` : '') + '紫正、绿负，半径为影响强度，竖向为年龄。字典码沿用原版类别映射。黄色合成箭杆与 +1 年外推仅作几何示意；跨轴方向保留在二维和原始轨迹中。';
    const panel = document.createElement('section');panel.className='mapping-panel';panel.setAttribute('aria-label','博导原版六类映射');
    const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    panel.innerHTML=`<h4>图中标记对应的原答与字段</h4><p>上方已将维度画在树上；这里保留六类构念与 F0–F20 的数值和来源。点选三维轨迹会同步切换。</p><label for="mappingEvent">查看经历</label><select id="mappingEvent">${payload.events.map(e=>`<option value="${safe(e.id)}">${safe(e.label)}</option>`).join('')}</select><div class="mapping-content" aria-live="polite"></div>`;
    const picker=panel.querySelector('select'),content=panel.querySelector('.mapping-content');
    const describeSource=value=>({self_report_centrality:'本人中心性评分',mentor_item_reference:'博导原版条目参考权重',display_default_only:'展示用中线（未作为实测值）',path_crossing_rule:'原版跨轴规则',path_crossing:'跨轴轨迹点',original_crossing_sample:'原绘图核心的跨轴采样点',self_report:'本人回答',unanswered:'未填写',not_applicable:'不适用'}[value]||value);
    const showMapping=id=>{
      const e=payload.events.find(e=>String(e.id)===String(id));if(!e)return;
      picker.value=e.id;const m=e.mapping;
      const valueFor=key=>{
        const value=m.fields[key];
        if(value==null){if(key==='F16_age_end'&&e.age_end==null)return '未定（原记录留空）';if(['F8_age_mid','F9_r_mid'].includes(key)&&m.sources.age_mid==='not_applicable')return '不适用';if(['F11_obj_raw','F12_obj_w'].includes(key))return '暂无适用的原版参考权重';return '未填写／待补充';}
        if(typeof value==='boolean')return value?'是':'否';
        if(key==='F20_delta_dir')return {up:'影响强度增加',down:'影响强度减少',flat:'变化小于 0.25'}[value]||value;
        return typeof value==='number'?String(Math.round(value*1000)/1000):String(value);
      };
      content.innerHTML=`<div class="mapping-grid">${root.EventMapping.groups.map(group=>`<section class="mapping-group"><h5>${safe(group.title)}</h5><dl>${group.keys.map(key=>`<div><dt>${safe(root.EventMapping.labels[key])}<small>${safe(key)}</small></dt><dd>${safe(valueFor(key))}</dd></div>`).join('')}</dl></section>`).join('')}</div><p class="mapping-provenance">角度来源：${safe(describeSource(m.sources.theta))}；后续变化来源：${safe(describeSource(m.sources.how))}；转折年龄／影响来源：${safe(describeSource(m.sources.age_mid))}／${safe(describeSource(m.sources.r_mid))}。</p><p>地点：${safe(e.where||'未填写')} → ${safe(m.sources.where_basis||'待补充')}；关键人物：${safe(m.sources.who_primary||'待补充')} → ${safe(m.sources.who_tie_basis||'待补充')}；原因：${safe(e.why||'未填写')} → ${safe(m.sources.why_basis||'待补充')}。</p><p>字典码与条目参考权重沿用博导提供的版本，并非本研究已验证的常模；体育新增和自填事件不套用权重。${m.sources.reference==='ambiguous_merged_references'?'这条合并记录对应多个原版条目，参考权重保留为空。':''}</p>`;
    };
    picker.addEventListener('change',()=>{showMapping(picker.value);iframe.contentWindow.postMessage({type:'sports-life-tree-select-event',id:picker.value},location.origin);});
    showMapping(payload.events[0].id);
    const receive = event => {
      if (event.origin !== location.origin || event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'sports-life-tree-ready') iframe.contentWindow.postMessage({ type: 'sports-life-tree-data', payload }, location.origin);
      if (event.data?.type === 'sports-life-tree-rendered') status.textContent = `已显示 ${event.data.count} 条作答轨迹 · 点击轨迹按钮查看情境与评分`;
      if (event.data?.type === 'sports-life-tree-error') status.textContent = '三维显示失败：' + event.data.message;
      if (event.data?.type === 'sports-life-tree-event-selected') showMapping(event.data.id);
    };
    window.addEventListener('message', receive);
    stopPrevious = () => window.removeEventListener('message', receive);
    host.append(iframe, status, note, panel);
  }
  root.LifeTree3D = { render, dispose, payloadFor };
})(typeof window !== 'undefined' ? window : globalThis);
