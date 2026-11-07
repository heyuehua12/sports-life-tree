const STORAGE_KEY = "sports-life-tree-prototype-v0.1";

const catalog = [...LifeEventCatalog, ...SportsEventCatalog.map(item => ({...item, source_scope: 'sports'}))];
let catalogScope = 'all';
let treeFilter = 'all';
let replayDrawingTutorial = false;

const options = {
  where: MentorReference.where,
  who: ["家人", "朋友", "同学", "老师", "恋人", "自己", "网上他人", "其他人", "说不清"],
};

const defaultState = () => ({
  schema_version: LifeHistory.VERSION,
  step: 0,
  profile: { age: "", year: "", pe_major: null, team_athlete: null, team_membership: null, sport: "", competition_history: null, training_history: null, award_history: null, activity_days: "", activity_minutes: "" },
  events: [],
  event_response: null,
  recall_log: [],
  order_history: [],
  merge_history: [],
  sports_event_response: null,
  tutor: null,
  tutor_sessions: [],
  details: {},
  scale: { resilience: null, anxiety: null, depression: null },
});

let state = loadState();
const stage = document.getElementById("stage");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const saveStatus = document.getElementById("saveStatus");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return defaultState();
    if (saved.schema_version !== LifeHistory.VERSION && !localStorage.getItem(STORAGE_KEY + '-before-v0.9.1')) {
      try { localStorage.setItem(STORAGE_KEY + '-before-v0.9.1', JSON.stringify(saved)); } catch (_) { saved.draft_backup_failed = true; }
    }
    const merged = Object.assign(defaultState(), saved);
    merged.profile = { ...defaultState().profile, ...saved.profile };
    EventOrder.normalize(merged);
    // Test the saved version, rather than the default version applied by Object.assign.
    merged.schema_version = saved.schema_version;
    LifeHistory.normalize(merged);
    if (saved.schema_version !== LifeHistory.VERSION && merged.step > 0) merged.step = 1;
    return merged;
  } catch (_) { return defaultState(); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (_) { saveStatus.textContent = '浏览器无法保存草稿，请及时下载 JSON'; return; }
  saveStatus.textContent = "草稿已保存 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

function eventById(id) { return state.events.find((e) => e.id === id); }
function currentAge() { return Math.max(16, Math.min(35, Number(state.profile.age) || 20)); }
function detailsFor(id) { state.details[id] ||= { where: null, who: [], why: null, how: null, closeness: null, autonomy: null, fairness: null }; return state.details[id]; }

function render() {
  LifeTree3D.dispose();
  LifeTreeTutor.dispose();
  const canDraw = StudyModel.canDraw(state.profile, state.events);
  if ((state.step === 2 || state.step === 3) && !canDraw) state.step = 1;
  document.body.classList.toggle("is-drawing", state.step === 2 && canDraw);
  document.body.classList.toggle("is-details", state.step === 3);
  if(state.step!==2)document.body.classList.remove('is-practicing');
  document.querySelectorAll(".step-dot").forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle("is-active", n === state.step);
    el.classList.toggle("is-done", n < state.step);
    if (n === state.step) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
    el.disabled = !canDraw && (n === 2 || n === 3);
  });
  backBtn.disabled = state.step === 0;
  nextBtn.textContent = state.step === 0 ? "进入经历" : state.step === 4 ? "下载 JSON" : state.step === 1 && !state.events.length ? "跳过生命树，继续" : "继续";
  if (state.step === 0) renderProfile();
  if (state.step === 1) renderEvents();
  if (state.step === 2) renderTrajectories();
  if (state.step === 3) renderDetails();
  if (state.step === 4) {
    renderReview();
    const group = StudyModel.participationGroup(state.profile);
    const names = { training_and_competition: "有专项训练，也参加过比赛", training_only: "有专项训练，未参加过比赛", competition_only: "参加过比赛，没有专项训练", neither: "没有比赛和专项训练经历", unknown: "比赛或训练经历尚未补充" };
    stage.querySelector(".stage-head").insertAdjacentHTML("afterend", `<div class="notice">体育经历：${names[group]}。无论属于哪类，正式调查都需完成相同的心理韧性、焦虑和抑郁测量；当前原型的正式量表仍待接入。</div>`);
    if (state.recall_log[0]?.source === "legacy_snapshot") stage.querySelector(".review-stat:last-child span").textContent = "首次回忆（旧草稿顺序推定）";
  }
  saveState();
}

function profileSportsFields() {
  const p = state.profile;
  const numberField = (key,label,min,max,step=1) => `<div class="field"><label for="${key}">${label}</label><input id="${key}" data-profile-field="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${esc(p[key] ?? '')}" /></div>`;
  const levelField = (key,label) => `<div class="field"><label for="${key}">${label}</label><select id="${key}" data-profile-field="${key}">${['','班级或院系','校级','社区或俱乐部','市级','省级','国家级','国际级','其他或说不清'].map(x=>`<option value="${x}" ${p[key]===x?'selected':''}>${x||'未填写'}</option>`).join('')}</select></div>`;
  return `${p.training_history===true ? `<section class="activity-section"><h3>专项训练背景（选填）</h3><p class="hint">用于区分训练量与事件影响；开始年龄回顾首次专项训练，每周安排按当前或最后一段训练填写。</p><div class="form-grid">${numberField('training_start_age','首次专项训练年龄（岁）',0,35,.1)}${numberField('training_years','累计专项训练年数',0,35,.1)}${numberField('training_days','每周训练天数',0,7)}${numberField('training_minutes','每次训练平均分钟数',0,1440)}</div></section>` : ''}${p.competition_history===true ? `<section class="activity-section"><h3>比赛与获奖背景（选填）</h3><div class="form-grid">${levelField('competition_level','参加过的最高比赛层级')}${p.award_history===true ? levelField('award_level','获奖的最高比赛层级') : ''}</div></section>` : ''}`;
}
function renderProfile() {
  const yesNo = (key, label, help) => `<div class="field"><label>${label}</label><div class="choice-row" data-choice="${key}" role="group" aria-label="${label}">${[[true,"有"],[false,"没有"]].map(([value,text])=>`<button class="choice ${state.profile[key] === value ? "is-selected" : ""}" aria-pressed="${state.profile[key] === value}" data-value="${value}" type="button">${text}</button>`).join("")}</div><p class="choice-help">${help}</p></div>`;
  stage.innerHTML = `
    <div class="stage-head">
      <div class="stage-kicker">第一步 · 背景</div>
      <h2>无论有没有体育经历，都欢迎参加。</h2>
      <p class="stage-lead">请回顾从小到现在的比赛和专项训练经历，包括已经停止的经历。体育专业、队伍身份与实际经历分别记录。</p>
    </div>
    <aside class="study-notice" aria-label="研究说明与数据边界">
      <div class="study-notice-title">这是交互原型，不是正式诊断问卷</div>
      <p>本页面用于开发“生活史 × 体育经历”的横断面研究工具。作答自愿，可随时返回或清空；当前回答只保存在本浏览器并可下载为 JSON，不会上传到 GitHub。本版本尚未接入正式的心理韧性、焦虑和抑郁量表，也不提供诊断或个体反馈。</p>
      <p>正式招募前仍需完成伦理审核、知情同意、敏感内容退出提示、心理支持资源说明和安全的数据收集后台。</p>
    </aside>
    <section class="profile-basics" aria-label="年龄与年级">
      <fieldset class="profile-picker"><legend>年龄 <span>点击选择周岁</span></legend><div class="age-options">${Array.from({length:20},(_,i)=>String(i+16)).map(value=>`<label class="pick-tile"><input type="radio" name="age" value="${value}" data-profile-pick="age" ${String(state.profile.age)===value?'checked':''}/><span>${value}</span></label>`).join('')}</div></fieldset>
      <fieldset class="profile-picker"><legend>年级 <span>点击选择</span></legend><div class="year-options">${['大一','大二','大三','大四','大五及以上','研究生'].map(value=>`<label class="pick-tile"><input type="radio" name="year" value="${value}" data-profile-pick="year" ${state.profile.year===value?'checked':''}/><span>${value}</span></label>`).join('')}</div></fieldset>
    </section>
    <div class="section-heading"><h3>你的体育背景</h3><p>身份和实际经历分别选择。</p></div><div class="form-grid profile-questions">
      <div class="field"><label>是否体育专业</label><div class="choice-row" data-choice="pe_major"><button class="choice ${state.profile.pe_major === true ? "is-selected" : ""}" data-value="true" type="button">是</button><button class="choice ${state.profile.pe_major === false ? "is-selected" : ""}" data-value="false" type="button">否</button></div><p class="choice-help">体育教育、运动训练、运动人体科学等均可选择是。</p></div>
      <div class="field"><label>是否参加过校队、院队或俱乐部队伍</label><div class="choice-row" data-choice="team_membership" role="group" aria-label="队伍身份"><button class="choice ${state.profile.team_membership === true ? "is-selected" : ""}" data-value="true" type="button">是</button><button class="choice ${state.profile.team_membership === false ? "is-selected" : ""}" data-value="false" type="button">否</button></div><p class="choice-help">记录队伍身份，包括过去已退出的队伍。</p></div>
      ${yesNo("competition_history", "是否曾参加过体育比赛？", "包括班级、院系、学校、社区及更高层级的体育比赛；不要求获奖。")}
      ${yesNo("training_history", "是否曾有专项体育训练经历？", "以运动技能或成绩为目标，按明确计划持续训练，包括教练指导、队伍训练和个人计划训练；仅常规体育课或随意锻炼不计入。")}
      ${state.profile.competition_history === true ? yesNo("award_history", "是否曾在体育比赛中获奖？", "包括个人或团队获得的名次、奖项或荣誉；参赛但未获奖同样可以参加研究。") : ""}
      <div class="field"><label for="sport">主要运动项目（选填）</label><input id="sport" value="${esc(state.profile.sport)}" placeholder="没有固定项目可以留空" /></div>
    </div>
    ${profileSportsFields()}
    <div class="activity-section"><h3>最近的日常身体活动</h3><p class="hint">没有专项训练，也可能经常运动。以下记录最近 7 天，包括体育课、锻炼和运动休闲。</p><div class="form-grid"><div class="field"><label for="activityDays">活动天数（0–7 天，选填）</label><input id="activityDays" type="number" min="0" max="7" step="1" value="${esc(state.profile.activity_days)}" /></div><div class="field"><label for="activityMinutes">活动当天平均分钟数（选填）</label><input id="activityMinutes" type="number" min="0" max="1440" step="1" value="${esc(state.profile.activity_minutes)}" /></div></div></div>`;
  stage.querySelectorAll('[data-profile-field]').forEach(input=>input.addEventListener('change',()=>{state.profile[input.dataset.profileField]=input.value;saveState();}));
  stage.querySelectorAll('[data-profile-pick]').forEach(input=>input.addEventListener('change',()=>{state.profile[input.dataset.profilePick]=input.value;saveState();}));
  document.getElementById("sport").addEventListener("input", (e) => { state.profile.sport = e.target.value; saveState(); });
  document.getElementById("activityDays").addEventListener("input", e => { state.profile.activity_days = e.target.value; saveState(); });
  document.getElementById("activityMinutes").addEventListener("input", e => { state.profile.activity_minutes = e.target.value; saveState(); });
  stage.querySelectorAll("[data-choice]").forEach((group) => group.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-value]"); if (!button) return;
    const key = group.dataset.choice; state.profile[key] = button.dataset.value === "true"; renderProfile(); saveState();
  }));
}


function renderEvents() {
  const eligible = LifeHistory.hasSpecialistExposure(state.profile);
  const available = catalog.filter(item => item.source_scope === 'general' || eligible || state.events.some(e => e.source_catalog_ids.includes(item.id)));
  const optionHTML = item => {
    const selected = state.events.filter(e => e.source_catalog_ids.includes(item.id));
    const combined = selected.some(e => e.source_catalog_ids.length > 1), multiple = selected.length > 1;
    const hint = [item.hint,combined?'已合并，可在已选列表管理':'',multiple?`已记录 ${selected.length} 次，可在已选列表管理`:''].filter(Boolean).join('；');
    return `<label class="event-option"><input type="checkbox" data-event="${item.id}" ${selected.length ? 'checked' : ''} ${combined||multiple ? 'disabled' : ''}/><span>${esc(item.label)}${hint?`<small>${esc(hint)}</small>`:''}</span></label>`;
  };
  const moduleHTML = (scope, title, intro) => {
    const items = available.filter(e => e.source_scope === scope);
    const groups=scope==='general'?[...new Set(items.map(e=>e.group_index))].sort((a,b)=>a-b).map(index=>({title:items.find(e=>e.group_index===index).group_title,items:items.filter(e=>e.group_index===index)})):[...new Set(items.map(e=>e.theme))].map(theme=>({title:theme,items:items.filter(e=>e.theme===theme)}));
    return `<section class="catalog-module"><h3>${title}<span class="module-count">${items.length} 项提示</span></h3><p class="hint">${intro}</p>${groups.map(({title:theme,items:group},i) => {
      const selectedCount = group.filter(item => state.events.some(e => e.source_catalog_ids.includes(item.id))).length;
      return `<section class="catalog-group"><h4 class="catalog-heading">${esc(theme)}<span>${group.length} 项${selectedCount ? ' · 已选 ' + selectedCount : ''}</span></h4><div class="event-layout">${[-1,1].map(v => {const side=group.filter(e=>e.valence===v);return `<div class="event-column ${v>0?'positive':''}"><h4>${v>0?'好事（画右边）':'不好的事（画左边）'}</h4>${scope==='general'?`<p class="category-name">${esc(side[0]?.theme||'')}</p>`:''}${side.map(optionHTML).join('')}</div>`;}).join('')}</div></section>`;
    }).join('')}</section>`;
  };
  const specialistEvents = state.events.some(LifeHistory.isSpecialistEvent);
  stage.innerHTML = `<div class="stage-head"><div class="stage-kicker">第二步 · 生活经历</div><h2>把生活与体育经历放在一起。</h2><p class="stage-lead">回顾从小到现在，记录实际发生且愿意分享的事情。没有比赛或专项训练经历，也可以记录家庭、学业、人际等一般生活经历。</p><p class="hint">按当时的感受选择好事或不好的事，不要求每类选满。不同清单指向同一件事时，只保留一件、多选领域标签；不同时间的两件事请分别记录。</p></div>
    <div class="view-filters" role="group" aria-label="事件清单范围">${[['all','全部清单'],['general','一般生活'],['sports','体育专项']].map(([key,label])=>`<button type="button" class="choice ${catalogScope===key?'is-selected':''}" data-catalog-scope="${key}" aria-pressed="${catalogScope===key}">${label}</button>`).join('')}</div>
    ${catalogScope !== 'sports' ? moduleHTML('general','一般生活事件','各领域已全部展开，请选择实际发生且愿意记录的事。同类事件发生多次时，可在已选列表中再次添加。') : ''}
    ${catalogScope !== 'general' ? (eligible ? moduleHTML('sports','体育专项事件','有比赛或专项训练经历时补充。已在一般生活中记过的同一件事，无需重复选择。') : '<p class="notice">背景中没有比赛和专项训练经历，体育专项清单暂不开放。体育课或日常运动经历仍可在一般生活中记录，并标注与体育的关系。</p>') : ''}
    <section class="custom-history"><h3>清单没有提到？自己补充一件</h3><div class="event-layout">${[-1,1].map(v=>`<div class="custom-event"><input id="${v>0?'customPos':'customNeg'}" maxlength="160" aria-label="自己写一件${v>0?'好事':'不好的事'}" placeholder="自己写一件${v>0?'好事':'不好的事'}"/><button type="button" class="small-button" data-custom="${v}">添加</button></div>`).join('')}</div></section>
    <div class="selected-strip" id="selectedEvents"></div>
    ${!state.events.length ? `<fieldset class="event-empty-response"><legend>生活事件部分的情况是：</legend>${responseChoices('event-response',state.event_response)}</fieldset>` : ''}
    ${eligible && !specialistEvents ? `<fieldset class="event-empty-response"><legend>体育专项事件部分的情况是：</legend>${responseChoices('sports-response',state.sports_event_response)}<p class="hint">有训练或比赛经历，不一定有愿意记录的事件；这与没有体育经历分开保存。</p></fieldset>` : ''}
    ${state.merge_history.length ? `<p class="hint">已合并 ${state.merge_history.length} 次。双方原始记录保存在导出的合并历史中。</p>` : ''}
    <p class="hint" id="eventMessage" role="status"></p>`;
  if(state.migrations?.length)stage.querySelector('.stage-head').insertAdjacentHTML('beforeend',`<p class="hint migration-note">草稿已升级，原有事件、轨迹和原答均保留。${state.events.some(e=>e.legacy_catalog)?'旧版清单记录仍在下方，不会被改写成新版题目。':''}${state.draft_backup_failed?'浏览器未能保存额外备份，请及时下载 JSON。':'升级前草稿已另存一份本机备份。'}</p>`);
  renderSelectedEvents();
  stage.querySelectorAll('[data-catalog-scope]').forEach(btn=>btn.addEventListener('click',()=>{catalogScope=btn.dataset.catalogScope;renderEvents();}));
  stage.querySelectorAll('[data-event]').forEach(input=>input.addEventListener('change',()=>toggleEvent(input.dataset.event,input.checked)));
  for (const [name,key] of [['event-response','event_response'],['sports-response','sports_event_response']]) stage.querySelectorAll(`[name="${name}"]`).forEach(input=>input.addEventListener('change',()=>{state[key]=input.value;saveState();}));
  stage.querySelectorAll('[data-custom]').forEach(btn=>btn.addEventListener('click',()=>{
    const input=document.getElementById(btn.dataset.custom==='1'?'customPos':'customNeg');
    if(!input.value.trim())return;addCustom(input.value.trim(),Number(btn.dataset.custom));renderEvents();saveState();
  }));
  nextBtn.textContent = state.events.length ? '进入共同生命树' : '跳过生命树，继续';
  document.querySelectorAll('[data-step="2"], [data-step="3"]').forEach(button=>{button.disabled=!StudyModel.canDraw(state.profile,state.events);});
}
function responseChoices(name,value) {
  return [['none_recalled','没有回忆起符合条目的经历'],['prefer_not_to_answer','暂不愿回忆或回答']].map(([key,label])=>`<label><input type="radio" name="${name}" value="${key}" ${value===key?'checked':''}/>${label}</label>`).join('');
}
function renderSelectedEvents(focusId) {
  const host=document.getElementById('selectedEvents');
  host.innerHTML=`<h3>已选顺序 · ${state.events.length} 件</h3><p class="hint order-help">按从左到右、从上到下的顺序画树。拖动手柄调整先后，也可点前移、后移；每张卡片直接选择体育关系。</p><ol class="selected-order-list" aria-label="已选经历顺序">${state.events.map((e,i)=>`<li class="selected-row selected-card--${e.valence>0?'pos':'neg'}" data-id="${e.id}">
    <div class="selected-row-main"><button type="button" class="order-handle" data-id="${e.id}" aria-label="拖动 ${esc(e.label)}，也可用方向键调整先后">⠿</button><span class="order-number ${e.valence>0?'tag-pos':'tag-neg'}">${String(i+1).padStart(2,'0')}</span><span class="order-label">${esc(e.label)}</span><div class="order-actions"><button type="button" data-id="${e.id}" data-move="-1" aria-label="前移 ${esc(e.label)}" ${i===0?'disabled':''}>←</button><button type="button" data-id="${e.id}" data-move="1" aria-label="后移 ${esc(e.label)}" ${i===state.events.length-1?'disabled':''}>→</button><button type="button" data-remove="${e.id}" aria-label="移除 ${esc(e.label)}">×</button></div></div>
    <div class="event-metadata"><fieldset class="relation-picker" id="relation-${e.id}"><legend>与体育的关系 <span>${e.relation_confirmed?'单选':'请选择'}</span></legend><div class="relation-options">${Object.entries(LifeHistory.RELATIONS).map(([key,label])=>`<label class="relation-option"><input type="radio" name="relation-${e.id}" data-relation="${e.id}" value="${key}" ${e.relation_confirmed&&e.sports_relation===key?'checked':''}/><span>${label}</span></label>`).join('')}</div></fieldset><fieldset class="domain-tags"><legend>涉及领域 · 可多选</legend>${LifeHistory.DOMAINS.map(tag=>`<label><input type="checkbox" data-domain="${e.id}" value="${tag}" ${e.domains.includes(tag)?'checked':''}/><span>${tag}</span></label>`).join('')}${LifeHistory.isSports(e)?'<span class="domain-badge">体育（已标注）</span>':''}</fieldset><button type="button" class="small-button repeat-event" data-repeat="${e.id}">再次记录同类事件</button>
    ${state.events.length>1 ? `<details class="merge-tools"><summary>与另一条记录是同一件事？</summary><p class="hint">不同时间发生的两件事不要合并。合并保留目标事件的轨迹和原答，双方原始记录会归档。</p><label for="merge-${e.id}">合并到</label><select id="merge-${e.id}">${state.events.filter(other=>other.id!==e.id).map(other=>`<option value="${other.id}">${esc(other.label)}</option>`).join('')}</select><button type="button" class="small-button" data-merge="${e.id}">合并同一件事</button></details>` : ''}</div></li>`).join('')}</ol>${!state.events.length?'<p class="hint">尚未选择事件。没有可记录的经历也可以继续。</p>':''}`;
  EventOrder.bind(host.querySelector('ol'),state,id=>{saveState();renderSelectedEvents(id);document.getElementById('eventMessage').textContent='顺序已更新，绘图与情境将使用同一顺序。';});
  host.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{state.events=state.events.filter(e=>e.id!==btn.dataset.remove);EventOrder.renumber(state);if(!state.events.length)state.event_response=null;renderEvents();saveState();}));
  host.querySelectorAll('[data-repeat]').forEach(btn=>btn.addEventListener('click',()=>{
    const source=eventById(btn.dataset.repeat),baseId=source.base_event_id||source.id,baseLabel=source.base_label||source.label;
    const occurrence=1+Math.max(...state.events.filter(e=>(e.base_event_id||e.id)===baseId).map(e=>e.occurrence||1));
    const repeat=LifeHistory.makeEvent({id:`repeat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:`${baseLabel}（第${occurrence}次）`,base_event_id:baseId,base_label:baseLabel,occurrence,valence:source.valence,domain:source.domain,domains:[...source.domains],source_scope:source.source_scope,source_scopes:[...source.source_scopes],source_catalog_ids:[...source.source_catalog_ids],source_catalog:source.source_catalog,aslec_bridge:source.aslec_bridge,custom:source.custom||false});
    EventOrder.add(state,repeat);state.event_response='events_selected';renderEvents();saveState();
  }));
  host.querySelectorAll('[data-relation]').forEach(input=>input.addEventListener('change',()=>{if(LifeHistory.setRelation(eventById(input.dataset.relation),input.value)){renderEvents();saveState();}}));
  host.querySelectorAll('[data-domain]').forEach(input=>input.addEventListener('change',()=>{const e=eventById(input.dataset.domain);e.domains=input.checked?[...new Set([...e.domains,input.value])]:e.domains.filter(t=>t!==input.value);saveState();}));
  host.querySelectorAll('[data-merge]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=document.getElementById('merge-'+btn.dataset.merge).value;
    const into=eventById(target), from=eventById(btn.dataset.merge);
    if(!confirm(`确定是同一件事，并合并到“${into.label}”？保留目标记录的${into.valence>0?'好事':'不好的事'}归属、轨迹和原答。双方原始记录会归档。`))return;
    if(LifeHistory.merge(state,from.id,target,{acceptValence:true})){renderEvents();saveState();document.getElementById('eventMessage').textContent='已合并为一件。请重新确认体育关系和领域标签。';}
  }));
  if(focusId)[...host.querySelectorAll('.order-handle')].find(b=>b.dataset.id===focusId)?.focus({preventScroll:true});
}
function toggleEvent(id,checked) {
  const item=catalog.find(e=>e.id===id);if(!item)return;
  if(checked&&!state.events.some(e=>e.source_catalog_ids.includes(id))){EventOrder.add(state,LifeHistory.makeEvent(item));state.event_response='events_selected';}
  if(!checked)state.events=state.events.filter(e=>!e.source_catalog_ids.includes(id));
  EventOrder.renumber(state);if(!state.events.length)state.event_response=null;renderEvents();saveState();
}
function addCustom(label,valence) {
  EventOrder.add(state,LifeHistory.makeEvent({id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:`自填：${label}`,domain:'自填',domains:[],source_scope:'custom',valence,custom:true}));
  state.event_response='events_selected';
}

function renderTrajectories() {
  LifeTreeTutor.dispose();
  const trained=state.tutor?.success&&state.tutor.version===LifeTreeTutor.VERSION;
  document.body.classList.toggle('is-practicing',!trained||replayDrawingTutorial);
  if(!trained||replayDrawingTutorial){
    stage.innerHTML=`<div class="practice-layout"><div class="practice-copy"><div class="stage-kicker">第三步 · 画线练习</div><h2>先试一笔，再画自己的经历。</h2><p class="stage-lead">假设一件不好的事，当时影响中等，后来变大，现在变小。看看如何用一根线记录这个过程。</p><ol class="practice-rules"><li>先看绿色示范线，再点击画板进入练习。</li><li>按住鼠标或手指，从下往上一笔连接：中 → 大 → 小。</li><li>越远离树干，影响越大；练习通过后开始画自己的树。</li></ol><p class="hint">这只是虚构示例，不会加入你的生活经历。</p><details class="keyboard-help"><summary>使用键盘练习</summary><p>按 Tab 聚焦画板。空格进入练习，再按空格落笔；方向键移动，Shift＋方向键微调，回车结束，Esc 清除当前一笔。</p></details><button type="button" class="ghost-button practice-back" id="practiceBack">${trained?'返回自己的生命树':'返回修改经历'}</button></div><div id="mentorTutor" class="mentor-tree-host practice-board-host"></div></div>`;
    document.getElementById('practiceBack').addEventListener('click',()=>{LifeTreeTutor.dispose();replayDrawingTutorial=false;if(trained)renderTrajectories();else{state.step=1;render();}});
    LifeTreeTutor.render({host:document.getElementById('mentorTutor'),onProgress:data=>{
      const index=state.tutor_sessions.findIndex(row=>row.session_id===data.session_id);
      if(index<0)state.tutor_sessions.push(data);else state.tutor_sessions[index]=data;
      saveState();
    },onComplete:data=>{state.tutor={...data,completed_at:new Date().toISOString()};replayDrawingTutorial=false;saveState();renderTrajectories();}});
    return;
  }
  LifeTreeUI.render({ stage, state, age: currentAge(), esc, save: saveState,
    onHelp:()=>{replayDrawingTutorial=true;renderTrajectories();},
    onBack: () => { state.step = 1; render(); window.scrollTo(0, 0); },
    onDone: () => { state.step = 3; render(); window.scrollTo(0, 0); } });
}


function renderDetails() {
  if(!state.events.length){stage.innerHTML='<h2>没有事件需要补充。</h2>';return;}
  stage.innerHTML=`<div class="stage-head"><div class="stage-kicker">第四步 · 情境</div><h2>每一件经历，都有相同的核心问题。</h2><p class="stage-lead">一般生活与体育经历按同一顺序回答。训练、比赛、伤病等专项问题，只在对应经历中出现；不适用的项目不会记为零。</p></div><div class="detail-list">${state.events.map(detailCard).join('')}</div>`;
  stage.querySelectorAll('[data-chip]').forEach(btn=>btn.addEventListener('click',()=>{
    const [id,field,value]=btn.dataset.chip.split('|'),d=detailsFor(id);
    const previous=EventMapping.derive(eventById(id),d,currentAge()).sources.who_primary;
    if(field==='who')d.who=d.who.includes(value)?d.who.filter(x=>x!==value):[...d.who,value];else d[field]=value;
    if(field==='where')d.where_basis=null;
    if(field==='why')d.why_basis=null;
    if(field==='how'){d.context_change_history||=[];d.context_change_history.push({field:'how',age_mid:d.age_mid??null,r_mid:d.r_mid??null});d.age_mid=null;d.r_mid=null;}
    if(field==='who'&&previous!==EventMapping.derive(eventById(id),d,currentAge()).sources.who_primary)resetPersonContext(d,previous);
    renderDetails();saveState();
  }));
  stage.querySelectorAll('[data-scale]').forEach(input=>input.addEventListener('input',()=>{
    const [id,field]=input.dataset.scale.split('|');const d=detailsFor(id);d[field]=Number(input.value);d.rating_provenance ||= {};d.rating_provenance[field]='self_report';updateFader(input,id,field,Number(input.value));saveState();
  }));
  stage.querySelectorAll('[data-event-rating]').forEach(input=>input.addEventListener('input',()=>{
    const [id,field]=input.dataset.eventRating.split('|');eventById(id)[field]=Number(input.value)/10;updateFader(input,id,field,Number(input.value));saveState();
  }));
  stage.querySelectorAll('[data-detail-field]').forEach(input=>input.addEventListener('change',()=>{
    const [id,field]=input.dataset.detailField.split('|');const d=detailsFor(id);
    if(field==='who_primary'&&input.value!==d.who_primary)resetPersonContext(d,d.who_primary);
    d[field]=input.value===''?null:field==='injury_related'?input.value==='true':field==='injury_stop_days'?Number(input.value):input.value;
    if(['injury_related','competition_outcome','who_primary','who_tie_basis'].includes(field))renderDetails();saveState();
  }));
}
function resetPersonContext(d,previous) {
  if(d.closeness!=null||d.who_tie_basis){d.context_change_history||=[];d.context_change_history.push({field:'who_primary',previous,closeness:d.closeness??null,who_tie_basis:d.who_tie_basis??null});}
  d.closeness=null;d.who_tie_basis=null;
}
function detailCard(e,index) {
  const d=detailsFor(e.id);d.who ||= [];
  const sport=LifeHistory.isSports(e),training=LifeHistory.isTraining(e),competition=LifeHistory.isCompetition(e);
  const referenceOptions=MentorReference.options[e.valence<0?'neg':'pos'];
  const resolution=EventMapping.resolution(e,d,currentAge());
  const primary=EventMapping.derive(e,d,currentAge()).sources.who_primary;
  const lists={
    where:[...options.where,...(sport?['训练场','比赛场']:[])],
    who:[...options.who,...(sport?['主教练','助教','队友','对手','裁判或组织者','学校或俱乐部管理者']:[])],
    why:[...referenceOptions.causes,...(sport?['自己的训练或表现','教练反馈或决策','队友支持或冲突','选拔、排名或比赛结果']:[])],how:referenceOptions.resolutions,
  };
  const chips=(field,multiple=false)=>[...new Set([...lists[field],...(multiple?d[field]||[]:d[field]?[d[field]]:[])])].map(x=>{
    const selected=multiple?d[field].includes(x):(field==='how'?resolution.how:d[field])===x;
    return `<button class="chip ${selected?'is-selected':''}" aria-pressed="${selected}" ${field==='how'&&resolution.source==='path_crossing_rule'?'disabled':''} data-chip="${e.id}|${field}|${esc(x)}" type="button">${esc(x)}</button>`;
  }).join('');
  const select=(field,label,choices)=>`<fieldset class="field detail-choices"><legend>${esc(label)}</legend><div class="chip-grid">${[...choices,['','暂不填写']].map(([value,text])=>`<label class="pick-tile detail-option"><input type="radio" name="detail-${esc(e.id)}-${field}" data-detail-field="${esc(e.id)}|${field}" value="${esc(value)}" ${String(d[field]??'')===String(value)?'checked':''}/><span>${esc(text)}</span></label>`).join('')}</div></fieldset>`;
  const pairs=values=>values.map(x=>[x,x]);
  const levels=['班级或院系','校级','社区或俱乐部','市级','省级','国家级','国际级','其他或说不清'].map(x=>[x,x]);
  const interpersonal=primary&&!['自己','说不清'].includes(primary);
  return `<article class="detail-card detail-card--${e.valence>0?'pos':'neg'}"><h3><span class="${e.valence>0?'tag-pos':'tag-neg'}">${String(index+1).padStart(2,'0')}</span> ${esc(e.label)}</h3><p class="hint">${e.domains.map(esc).join(' · ')} · ${LifeHistory.RELATIONS[e.sports_relation]||'体育关系待确认'}</p>
    <div class="field"><label>主要发生在哪里？</label><div class="chip-grid">${chips('where')}</div></div>
    ${d.where&&!MentorReference.where.includes(d.where)?select('where_basis','这个地点主要属于哪类生活场景？',pairs(MentorReference.where)):''}
    <div class="field"><label>主要和谁有关？可多选</label><div class="chip-grid">${chips('who',true)}</div></div>
    ${d.who.length>1?select('who_primary','其中对这件事最关键的是谁？',pairs(d.who)):''}
    ${primary&&!MentorReference.who.includes(primary)?select('who_tie_basis','这位关键人物与你的关系更接近哪一类？',pairs(MentorReference.who)):''}
    <div class="field"><label>主要因为什么？</label><div class="chip-grid">${chips('why')}</div></div>
    ${d.why&&!referenceOptions.causes.includes(d.why)?select('why_basis','这个原因更接近哪一类？',pairs(referenceOptions.causes)):''}
    <div class="field"><label>后来怎么样了？</label><div class="chip-grid">${chips('how')}</div></div>
    ${resolution.source==='path_crossing_rule'?`<p class="hint">按博导原版规则，轨迹跨过中线后带入“${esc(resolution.how)}”。如不符合本意，请返回修改轨迹；之前的原答仍保留。</p>`:''}
    ${resolution.need_mid?`<div class="context-faders">${fader(e.id,'age_mid','明显转折大约发生在几岁？',resolution.age_mid,resolution.hi,'data-scale',resolution.lo)}${fader(e.id,'r_mid','转折时的影响有多强？',resolution.r_mid,1,'data-scale')}</div><p class="hint">${['path_crossing','original_crossing_sample'].includes(resolution.age_mid_source)?'年龄由跨轴轨迹点带入，可调整。':'请回忆这段轨迹中的明显转折年龄。'}${['path_crossing','original_crossing_sample'].includes(resolution.r_mid_source)?'影响由同一轨迹点带入，可调整。':''} 未操作的空项不会写入默认值。</p>`:''}
    ${interpersonal?`<div class="context-faders">${fader(e.id,'closeness',`与关键人物（${primary}）的亲近／信任程度`,LifeHistory.ratingValue(d,'closeness'),1,'data-scale')}</div>`:'<p class="hint">涉及多人时先选一位关键人物，再补充亲近／信任程度。</p>'}
    ${eventRatings(e)}
    ${training||competition?`<section class="sports-detail"><h4>这件经历的体育专项信息（选填）</h4><div class="context-faders">${training?fader(e.id,'autonomy','当时对训练安排的自主程度',LifeHistory.ratingValue(d,'autonomy'),1,'data-scale'):''}${fader(e.id,'fairness','当时对安排和机会的公平感',LifeHistory.ratingValue(d,'fairness'),1,'data-scale')}</div><div class="form-grid">${training?select('training_phase','当时主要处于哪个训练阶段？',[['start','开始训练'],['stable','持续训练'],['intensified','强化或备赛'],['pause','暂停训练'],['return','恢复训练'],['exit','退出训练'],['uncertain','说不清']]):''}${competition?select('competition_level','这件事涉及的比赛层级',levels)+select('competition_outcome','本次比赛或选拔的结果',[['awarded','获得名次、奖项或荣誉'],['not_awarded','参赛但未获奖'],['participation','以参与或选拔经历为主'],['uncertain','说不清']]):''}${competition&&(e.source_catalog_ids.includes('award')||d.competition_outcome==='awarded')?select('award_level','这次获奖的比赛层级',levels):''}${select('injury_related','这件事是否涉及运动伤病？',[[true,'是'],[false,'否']])}${d.injury_related===true?`<div class="field"><label for="days-${e.id}">因本次伤病完全停止训练的天数（0 表示未完全停训）</label><input id="days-${e.id}" type="number" min="0" max="${currentAge()*366}" step="1" data-detail-field="${e.id}|injury_stop_days" value="${esc(d.injury_stop_days??'')}"/></div>`:''}</div></section>`:''}
    <p class="hint">未操作的评分保留为未作答；旧版来源不明的评分需重新操作确认，原值保留在原答中。不适用的专项字段在导出时单独标记。</p></article>`;
}

function fader(id, field, label, value, max, attribute, min=0) {
  const inputId = `rating-${id}-${field}`;
  const current = value == null ? (min+max) / 2 : value;
  return `<div class="field fader-field ${value == null ? "is-unanswered" : ""}">
    <div class="fader-heading"><label for="${inputId}">${esc(label)}</label><output class="fader-value" id="${id}-${field}" for="${inputId}">${value == null ? "未作答" : Number(value).toFixed(max === 1 ? 2 : 1)}</output></div>
    <div class="fader-control"><input class="mixing-fader" id="${inputId}" ${attribute}="${id}|${field}" type="range" min="${min}" max="${max}" step="${max === 1 ? .01 : .1}" value="${current}" style="--range-fill:${max===min?0:(current-min)/(max-min)*100}%" /><div class="fader-ticks" aria-hidden="true"></div></div>
    <div class="fader-ends" aria-hidden="true"><span>${field==='age_mid'?'起始年龄':'低'} · ${min}</span><span>${field==='age_mid'?'结束年龄':'高'} · ${max}</span></div>
  </div>`;
}

function updateFader(input, id, field, value) {
  document.getElementById(`${id}-${field}`).textContent = value.toFixed(Number(input.max) === 1 ? 2 : 1);
  const min=Number(input.min),max=Number(input.max);
  input.style.setProperty("--range-fill", `${max===min?0:(value-min)/(max-min)*100}%`);
  input.closest(".fader-field").classList.remove("is-unanswered");
}

function eventRatings(event) {
  return `<div class="event-ratings context-faders">${[["centrality", "在人生故事中有多重要？"], ["now_salience", "现在还影响你多少？"]].map(([field, label]) => fader(event.id, field, label, event[field] == null ? null : event[field] * 10, 10, "data-event-rating")).join("")}<p class="hint">这两项为 0 至 10 分。滑块初始位置只供操作，调整后才记录答案。</p></div>`;
}


function buildPayload() {
  const first=state.recall_log.slice().sort((a,b)=>a.recall_order-b.recall_order)[0];
  let canonicalFirst=first?.id||null;
  state.merge_history.forEach(entry=>{if(canonicalFirst===entry.from_id)canonicalFirst=entry.into_id;});
  if(!state.events.some(e=>e.id===canonicalFirst))canonicalFirst=null;
  const numeric=key=>state.profile[key]!==''&&state.profile[key]!=null?Number(state.profile[key]):null;
  const exposure={...StudyModel.exposure(state.profile),
    training_start_age:state.profile.training_history===true?numeric('training_start_age'):null,
    training_years:state.profile.training_history===true?numeric('training_years'):null,
    training_days:state.profile.training_history===true?numeric('training_days'):null,
    training_minutes:state.profile.training_history===true?numeric('training_minutes'):null,
    training_schedule_window:'current_or_last_training_period',
    competition_level:state.profile.competition_history===true?state.profile.competition_level||null:null,
    award_level:state.profile.competition_history===true&&state.profile.award_history===true?state.profile.award_level||null:null};
  const sportsN=state.events.filter(LifeHistory.isSports).length;
  const specialistEvents=state.events.some(LifeHistory.isSpecialistEvent);
  return {version:LifeHistory.VERSION,drawing_reference:'life-timeline-hosted-v3.6.3',created_at:new Date().toISOString(),
    profile:state.profile,exposure,
    events:state.events.map(e=>{
      const details=LifeHistory.detailsForExport(e,state.details[e.id]||{});
      const mapping=EventMapping.derive(e,details,currentAge());
      const unanswered=['where','why'].filter(key=>details[key]==null);
      if(mapping.how==null)unanswered.push('how');
      if(!details.who.length)unanswered.push('who');
      for(const key of ['centrality','now_salience'])if(e[key]==null)unanswered.push(key);
      return {...e,mapping,details,details_raw:state.details[e.id]||null,training_timing:LifeHistory.timing(e,state.profile),unanswered_core_fields:unanswered};
    }),scales:state.scale,
    process:{n_events:state.events.length,n_sports_related:sportsN,n_non_sports:state.events.filter(e=>e.sports_relation==='none').length,
      n_unclassified:state.events.filter(e=>!LifeHistory.isSports(e)&&e.sports_relation!=='none').length,
      event_response:state.events.length?'events_selected':state.event_response,
      sports_specialist_response:!LifeHistory.hasSpecialistExposure(state.profile)?'not_applicable_no_exposure':specialistEvents?'events_selected':state.sports_event_response,
      first_recall_event:first?.id||null,first_recall_canonical_id:canonicalFirst,first_recall_source:first?.source||null,
      recall_log:state.recall_log,order_history:state.order_history,merge_history:state.merge_history,
      migrations:state.migrations||[],final_event_order:state.events.map(e=>e.id),skipped_event_pages:!state.events.length,
      tutor:state.tutor,tutor_sessions:state.tutor_sessions,general_catalog:'mentor-options-v2.1',
      outcome_scales_status:'not_integrated',unselected_items_are_confirmed_absence:false}};
}
function renderReview() {
  const payload=buildPayload();
  const showTree=state.events.some(e=>LifeTree.isComplete(e,currentAge()));
  stage.innerHTML=`<div class="stage-head"><div class="stage-kicker">第五步 · 检查</div><h2>生活与体育，在同一条时间线上。</h2><p class="stage-lead">记录只保存在当前浏览器，可下载 JSON。这里的轨迹是回顾性自评，不表示因果关系。</p></div>
    <div class="review-grid"><div class="review-stat"><strong>${state.events.length}</strong><span>去重后的事件数</span></div><div class="review-stat"><strong>${payload.process.n_non_sports} / ${payload.process.n_sports_related}</strong><span>一般生活（非体育）／体育相关</span></div><div class="review-stat"><strong>${state.events[0]?'已记录':'无事件'}</strong><span>首次回忆顺序另行保留</span></div></div>
    ${payload.process.n_unclassified?`<p class="notice">${payload.process.n_unclassified} 件经历的体育关系为说不清或未确认，只显示在“全部”中，不归入无体育事件。</p>`:''}
    <div class="notice">正式心理韧性、焦虑、抑郁量表仍待接入；所有学生将完成相同量表。本页不是正式调查完成页。</div>
    ${showTree?`<section class="common-tree-card"><h3>你的共同生命树</h3><div class="view-filters" role="group" aria-label="生命树查看范围">${[['all','全部'],['general','一般生活（非体育）'],['sports','体育相关']].map(([key,label])=>`<button type="button" class="choice ${treeFilter===key?'is-selected':''}" aria-pressed="${treeFilter===key}" data-tree-filter="${key}">${label}</button>`).join('')}<label for="treeDomain">领域</label><select id="treeDomain"><option value="">全部领域</option>${[...LifeHistory.DOMAINS,'体育'].map(x=>`<option>${x}</option>`).join('')}</select></div><p class="hint">切换范围仅改变显示，同一事件无论有多少领域标签都只计一次。领域重叠的分组数量不能直接相加。</p><div id="commonTree2D"></div><section class="three-d-card" aria-labelledby="threeDHeading"><h3 id="threeDHeading">同一批经历的 3D 生命树</h3><p>拖动旋转、缩放，点击轨迹查看原答。二维图保留跨轴方向，三维沿用博导原版的半区展示。</p><div id="threeDTree" class="three-d-host"></div></section></section>`:''}
    <p class="hint">原始情境答案、合并历史与未作答信息一并导出。正式分析时需区分不适用、未作答和真实的零。</p><textarea class="json-box" readonly aria-label="可导出的问卷记录">${esc(JSON.stringify(payload,null,2))}</textarea>`;
  if(showTree){
    const domain=document.getElementById('treeDomain');
    const update=()=>{
      const events=state.events.filter(e=>LifeHistory.matchesFilter(e,treeFilter)&&(!domain.value||e.domains.includes(domain.value)));
      LifeTreeView.render({host:document.getElementById('commonTree2D'),events,age:currentAge(),esc});
      const details=Object.fromEntries(events.map(e=>[e.id,LifeHistory.detailsForExport(e,state.details[e.id]||{})]));
      LifeTree3D.render({host:document.getElementById('threeDTree'),events,details,age:currentAge()});
    };
    stage.querySelectorAll('[data-tree-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      treeFilter=btn.dataset.treeFilter;
      stage.querySelectorAll('[data-tree-filter]').forEach(b=>{b.classList.toggle('is-selected',b.dataset.treeFilter===treeFilter);b.setAttribute('aria-pressed',String(b.dataset.treeFilter===treeFilter));});update();
    }));
    domain.addEventListener('change',update);update();
  }
}

function downloadJSON() { const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sports-life-tree-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href); }

function validate() {
  if (state.step === 0 && (!Number.isInteger(Number(state.profile.age)) || Number(state.profile.age) < 16 || Number(state.profile.age) > 35)) {
    alert("请点击选择 16 至 35 岁之间的年龄。"); return false;
  }
  if (state.step === 0) {
    if (StudyModel.participationGroup(state.profile) === "unknown") { alert("请分别选择是否有比赛经历、是否有专项训练经历。"); return false; }
    if (state.profile.competition_history === true && typeof state.profile.award_history !== "boolean") { alert("请补充是否曾在体育比赛中获奖。"); return false; }
    if(state.profile.training_history===true){
      for(const [key,label,max,integer] of [['training_start_age','首次训练年龄',Number(state.profile.age),false],['training_years','训练年数',Number(state.profile.age),false],['training_days','每周训练天数',7,true],['training_minutes','每次训练分钟数',1440,true]]){
        const value=state.profile[key];
        if(value!==''&&value!=null&&(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>max||(integer&&!Number.isInteger(Number(value))))){alert(`请填写有效的${label}，或留空。`);return false;}
      }
    }
    for (const [key,max] of [["activity_days",7],["activity_minutes",1440]]) {
      const value = state.profile[key];
      if (value !== "" && (!Number.isInteger(Number(value)) || Number(value)<0 || Number(value)>max)) { alert(key === "activity_days" ? "活动天数请填写 0 至 7 的整数，或留空。" : "平均分钟数请填写 0 至 1440 的整数，或留空。"); return false; }
    }
  }
  if (state.step === 1) {
    let message = "";
    message = LifeHistory.validationErrors(state.profile,state.events,state).join(' ');
    if (message) { document.getElementById("eventMessage").textContent = message; return false; }
  }
  if (state.step === 2) {
    if(!state.tutor?.success||state.tutor.version!==LifeTreeTutor.VERSION){renderTrajectories();return false;}
    const index = state.events.findIndex((event) => !LifeTree.isComplete(event, currentAge()));
    if (index >= 0) {
      state.trajectoryIndex = index; renderTrajectories();
      document.getElementById("drawStatus").textContent = "还有经历未画，请按顺序画完，或返回修改勾选。";
      return false;
    }
  }
  if (state.step === 3) {
    const badMid=state.events.find(e=>{const d=state.details[e.id]||{},h=EventMapping.resolution(e,d,currentAge());return h.need_mid&&d.age_mid!=null&&(!Number.isFinite(Number(d.age_mid))||Number(d.age_mid)<h.lo||Number(d.age_mid)>h.hi);});
    if(badMid){alert(`请核对“${badMid.label}”的转折年龄，应在当前轨迹起止年龄之间。`);return false;}
    const awardConflict=state.events.find(e=>{
      const d=LifeHistory.detailsForExport(e,state.details[e.id]||{});
      return (d.competition_outcome==='awarded'&&state.profile.award_history!==true)||(e.source_catalog_ids.includes('award')&&d.competition_outcome==='not_awarded');
    });
    if(awardConflict){alert(`“${awardConflict.label}”的获奖原答与背景或已选条目不一致，请返回核对。`);return false;}
    const invalid = state.events.find(e => {
      const d=LifeHistory.detailsForExport(e,state.details[e.id]||{});
      return d.injury_stop_days!=null && (!Number.isInteger(d.injury_stop_days)||d.injury_stop_days<0||d.injury_stop_days>currentAge()*366);
    });
    if(invalid){alert(`请核对“${invalid.label}”的停训天数：填写有效的非负整数，或留空。`);return false;}
  }
  return true;
}
nextBtn.addEventListener("click", () => { if (!validate()) return; if (state.step === 4) { downloadJSON(); return; } state.step = state.step === 1 && !state.events.length ? 4 : state.step + 1; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
backBtn.addEventListener("click", () => { if (state.step > 0) { state.step = state.step === 4 && !state.events.length ? 1 : state.step - 1; render(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
document.getElementById("resetBtn").addEventListener("click", () => { if (!window.confirm("清空本地草稿并重新开始？")) return; localStorage.removeItem(STORAGE_KEY); state = defaultState(); render(); });
document.querySelectorAll(".step-dot").forEach((btn) => btn.addEventListener("click", () => { const n = Number(btn.dataset.step); if (n <= state.step) { state.step = n; render(); } }));

render();
