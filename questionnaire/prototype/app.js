const STORAGE_KEY = "sports-life-tree-prototype-v0.1";

const catalog = SportsEventCatalog;

const options = {
  where: ["训练场", "比赛场", "家庭或宿舍", "学校管理场景", "线上", "多个场景", "说不清"],
  who: ["主教练", "助教", "队友", "对手", "裁判或组织者", "家人", "同学或朋友", "学校或俱乐部管理者", "自己", "其他人"],
  why: ["自己的训练或表现", "教练反馈或决策", "队友支持或冲突", "选拔、排名或比赛结果", "伤病或身体状态", "资源或机会", "家庭或学业压力", "偶然机会", "说不清"],
  how: ["持续变好", "短期变好后回落", "一直保持", "一直困难", "有人帮助后改善", "因伤病或落选中断", "后来失去", "说不清"],
};

const defaultState = () => ({
  step: 0,
  profile: { age: "", year: "", pe_major: null, team_athlete: null, team_membership: null, sport: "", competition_history: null, training_history: null, award_history: null, activity_days: "", activity_minutes: "" },
  events: [],
  event_response: null,
  recall_log: [],
  order_history: [],
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
    const merged = Object.assign(defaultState(), saved);
    merged.profile = { ...defaultState().profile, ...saved.profile };
    EventOrder.normalize(merged);
    return merged;
  } catch (_) { return defaultState(); }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStatus.textContent = "草稿已保存 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

function eventById(id) { return state.events.find((e) => e.id === id); }
function currentAge() { return Math.max(16, Math.min(35, Number(state.profile.age) || 20)); }
function detailsFor(id) { state.details[id] ||= { where: null, who: [], why: null, how: null, closeness: 0.5, autonomy: 0.5, fairness: 0.5 }; return state.details[id]; }

function render() {
  LifeTree3D.dispose();
  const canDraw = StudyModel.canDraw(state.profile, state.events);
  if ((state.step === 2 || state.step === 3) && !canDraw) state.step = 1;
  document.body.classList.toggle("is-drawing", state.step === 2 && canDraw);
  document.body.classList.toggle("is-details", state.step === 3);
  document.querySelectorAll(".step-dot").forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle("is-active", n === state.step);
    el.classList.toggle("is-done", n < state.step);
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

function renderProfile() {
  const yesNo = (key, label, help) => `<div class="field"><label>${label}</label><div class="choice-row" data-choice="${key}" role="group" aria-label="${label}">${[[true,"有"],[false,"没有"]].map(([value,text])=>`<button class="choice ${state.profile[key] === value ? "is-selected" : ""}" aria-pressed="${state.profile[key] === value}" data-value="${value}" type="button">${text}</button>`).join("")}</div><p class="choice-help">${help}</p></div>`;
  stage.innerHTML = `
    <div class="stage-head">
      <div class="stage-kicker">第一步 · 背景</div>
      <h2>无论有没有体育经历，都欢迎参加。</h2>
      <p class="stage-lead">请回顾从小到现在的比赛和专项训练经历，包括已经停止的经历。体育专业、队伍身份与实际经历分别记录。</p>
    </div>
    <div class="form-grid">
      <div class="field"><label for="age">年龄</label><input id="age" type="number" min="16" max="35" value="${esc(state.profile.age)}" placeholder="例如 20" /></div>
      <div class="field"><label for="year">年级</label><select id="year"><option value="">请选择</option><option>大一</option><option>大二</option><option>大三</option><option>大四</option><option>研究生</option></select></div>
      <div class="field"><label>是否体育专业</label><div class="choice-row" data-choice="pe_major"><button class="choice ${state.profile.pe_major === true ? "is-selected" : ""}" data-value="true" type="button">是</button><button class="choice ${state.profile.pe_major === false ? "is-selected" : ""}" data-value="false" type="button">否</button></div><p class="choice-help">体育教育、运动训练、运动人体科学等均可选择是。</p></div>
      <div class="field"><label>是否参加过校队、院队或俱乐部队伍</label><div class="choice-row" data-choice="team_membership" role="group" aria-label="队伍身份"><button class="choice ${state.profile.team_membership === true ? "is-selected" : ""}" data-value="true" type="button">是</button><button class="choice ${state.profile.team_membership === false ? "is-selected" : ""}" data-value="false" type="button">否</button></div><p class="choice-help">记录队伍身份，包括过去已退出的队伍。</p></div>
      ${yesNo("competition_history", "是否曾参加过体育比赛？", "包括班级、院系、学校、社区及更高层级的体育比赛；不要求获奖。")}
      ${yesNo("training_history", "是否曾有专项体育训练经历？", "以运动技能或成绩为目标，按明确计划持续训练，包括教练指导、队伍训练和个人计划训练；仅常规体育课或随意锻炼不计入。")}
      ${state.profile.competition_history === true ? yesNo("award_history", "是否曾在体育比赛中获奖？", "包括个人或团队获得的名次、奖项或荣誉；参赛但未获奖同样可以参加研究。") : ""}
      <div class="field"><label for="sport">主要运动项目（选填）</label><input id="sport" value="${esc(state.profile.sport)}" placeholder="没有固定项目可以留空" /></div>
    </div>
    <div class="activity-section"><h3>最近的日常身体活动</h3><p class="hint">没有专项训练，也可能经常运动。以下记录最近 7 天，包括体育课、锻炼和运动休闲。</p><div class="form-grid"><div class="field"><label for="activityDays">活动天数（0–7 天，选填）</label><input id="activityDays" type="number" min="0" max="7" step="1" value="${esc(state.profile.activity_days)}" /></div><div class="field"><label for="activityMinutes">活动当天平均分钟数（选填）</label><input id="activityMinutes" type="number" min="0" max="1440" step="1" value="${esc(state.profile.activity_minutes)}" /></div></div></div>`;
  const year = document.getElementById("year"); year.value = state.profile.year;
  document.getElementById("age").addEventListener("input", (e) => { state.profile.age = e.target.value; saveState(); });
  document.getElementById("sport").addEventListener("input", (e) => { state.profile.sport = e.target.value; saveState(); });
  year.addEventListener("change", (e) => { state.profile.year = e.target.value; saveState(); });
  document.getElementById("activityDays").addEventListener("input", e => { state.profile.activity_days = e.target.value; saveState(); });
  document.getElementById("activityMinutes").addEventListener("input", e => { state.profile.activity_minutes = e.target.value; saveState(); });
  stage.querySelectorAll("[data-choice]").forEach((group) => group.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-value]"); if (!button) return;
    const key = group.dataset.choice; state.profile[key] = button.dataset.value === "true"; renderProfile(); saveState();
  }));
}

function renderEvents() {
  const neither = StudyModel.participationGroup(state.profile) === "neither";
  const showCatalog = !neither || state.events.length > 0;
  const positives = catalog.filter((x) => x.valence > 0); const negatives = catalog.filter((x) => x.valence < 0);
  const optionHTML = (item) => { const checked = !!eventById(item.id); return `<label class="event-option"><input type="checkbox" data-event="${item.id}" ${checked ? "checked" : ""} /><span>${esc(item.label)}<small>${esc(item.domain)} · ${esc(item.hint)}</small></span></label>`; };
  const groupedOptions = items => ["比赛、选拔与机会", "训练、身体与学业", "关系、支持与归属"].map(theme => `<section class="event-subgroup" aria-label="${theme}"><h4>${theme}</h4>${items.filter(item=>item.theme===theme).map(optionHTML).join("")}</section>`).join("");
  stage.innerHTML = `
    <div class="stage-head"><div class="stage-kicker">第二步 · 经历</div><h2>${neither ? "没有比赛或专项训练经历，也是一种真实情况。" : "把值得记住的体育经历列出来。"}</h2><p class="stage-lead">${neither ? "无需绘制体育生命树，也无需填写事件情境。正式调查中的心理韧性、焦虑和抑郁测量对所有学生保持一致。" : "请只选自己实际经历、愿意记录的事情。不要求获奖，也不需要把两边选满。先自由勾选，再按发生时间从早到晚排列；最初回忆顺序会另行保留。"}</p>${!neither ? '<p class="hint event-reading-hint">“好事”和“不好的事”按你当时的感受选择；后来影响改变，可以在生命树中画出来。没有列出的经历可在两栏底部自填。</p>' : ''}</div>
    ${neither && state.events.length ? '<p class="notice">背景中选择了没有比赛和训练经历，但这里仍有已选事件。请返回核对背景，或逐项移除不适用事件。</p>' : ''}
    ${showCatalog ? `<div class="event-layout"><div class="event-column"><h3>不好的事 · ${negatives.length} 项</h3><p>绿色 · 比赛、训练或体育环境中的困难。</p>${groupedOptions(negatives)}<div class="custom-event"><input id="customNeg" aria-label="自己写一件不好的事" placeholder="自己写一件不好的事" /><button class="small-button" data-custom="-1" type="button">添加</button></div></div><div class="event-column positive"><h3>好事 · ${positives.length} 项</h3><p>紫色 · 参与、进步、恢复、支持与认可。</p>${groupedOptions(positives)}<div class="custom-event"><input id="customPos" aria-label="自己写一件好事" placeholder="自己写一件好事" /><button class="small-button" data-custom="1" type="button">添加</button></div></div></div>` : '<div class="notice">已记录：没有体育比赛和专项训练经历。日常运动不因此记为零。接下来跳过体育生命树。</div>'}
    <div class="selected-strip" id="selectedEvents"></div>
    ${!state.events.length && !neither ? `<fieldset class="event-empty-response"><legend>这一部分的情况是：</legend>${[["none_recalled","没有符合条目的经历"],["prefer_not_to_answer","暂不愿回忆或回答"]].map(([value,label]) => `<label><input type="radio" name="event-response" value="${value}" ${state.event_response === value ? "checked" : ""} />${label}</label>`).join("")}</fieldset>` : ''}
    <p class="hint" id="eventMessage" role="status"></p>`;
  renderSelectedEvents();
  stage.querySelectorAll("[data-event]").forEach((input) => input.addEventListener("change", () => toggleEvent(input.dataset.event, input.checked)));
  stage.querySelectorAll('[name="event-response"]').forEach(input => input.addEventListener("change", () => { state.event_response = input.value; saveState(); }));
  stage.querySelectorAll("[data-custom]").forEach((btn) => btn.addEventListener("click", () => { const input = document.getElementById(btn.dataset.custom === "1" ? "customPos" : "customNeg"); const label = input.value.trim(); if (!label) return; addCustom(label, Number(btn.dataset.custom)); input.value = ""; renderEvents(); saveState(); }));
  nextBtn.textContent = !state.events.length ? "跳过生命树，继续" : "继续";
}

function renderSelectedEvents(focusId) {
  const host = document.getElementById("selectedEvents");
  host.innerHTML = `<h3>已选顺序 · ${state.events.length} 件</h3><p class="hint order-help">按发生时间从早到晚排列。拖动左侧手柄调整，也可使用上移、下移按钮。</p><ol class="selected-order-list" aria-label="已选经历顺序">${state.events.map((e,i)=>`<li class="selected-row" data-id="${e.id}"><button type="button" class="order-handle" data-id="${e.id}" aria-label="拖动 ${esc(e.label)}，也可用上下方向键" title="拖动或按上下方向键">⠿</button><span class="order-number ${e.valence > 0 ? 'tag-pos' : 'tag-neg'}">${String(i+1).padStart(2,'0')}</span><span class="order-label">${esc(e.label)}</span><div class="order-actions"><button type="button" data-id="${e.id}" data-move="-1" aria-label="上移 ${esc(e.label)}" ${i===0?'disabled':''}>↑</button><button type="button" data-id="${e.id}" data-move="1" aria-label="下移 ${esc(e.label)}" ${i===state.events.length-1?'disabled':''}>↓</button><button type="button" data-remove="${e.id}" aria-label="移除 ${esc(e.label)}">×</button></div></li>`).join("")}</ol>${!state.events.length ? '<p class="hint">尚未选择事件。</p>' : ''}`;
  EventOrder.bind(host.querySelector("ol"), state, id => { saveState(); renderSelectedEvents(id); document.getElementById("eventMessage").textContent = "顺序已更新，生命树将按此顺序绘制。"; });
  host.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => { state.events = state.events.filter(e=>e.id !== btn.dataset.remove); EventOrder.renumber(state); if(!state.events.length)state.event_response=null; renderEvents(); saveState(); }));
  if (focusId) [...host.querySelectorAll(".order-handle")].find(button=>button.dataset.id===focusId)?.focus({preventScroll:true});
}

function toggleEvent(id, checked) {
  const item = catalog.find((x) => x.id === id); if (!item) return;
  if (checked && !eventById(id)) { EventOrder.add(state, item); state.event_response = "events_selected"; }
  if (!checked) state.events = state.events.filter((e) => e.id !== id);
  EventOrder.renumber(state); if (!state.events.length) state.event_response = null; renderEvents(); saveState();
}

function addCustom(label, valence) { EventOrder.add(state, { id: `custom-${Date.now()}`, label: `自填：${label}`, domain: "自填", valence, custom: true }); state.event_response = "events_selected"; }

function renderTrajectories() {
  LifeTreeUI.render({ stage, state, age: currentAge(), esc, save: saveState,
    onBack: () => { state.step = 1; render(); window.scrollTo(0, 0); },
    onDone: () => { state.step = 3; render(); window.scrollTo(0, 0); } });
}

function renderDetails() {
  if (!state.events.length) { stage.innerHTML = `<div class="stage-head"><div class="stage-kicker">第四步 · 情境</div><h2>没有事件需要补充标签。</h2><p class="stage-lead">下一步会显示当前记录摘要。</p></div>`; return; }
  stage.innerHTML = `<div class="stage-head"><div class="stage-kicker">第四步 · 情境</div><h2>给每一件经历补上同一组核心维度。</h2><p class="stage-lead">这是全局事件矩阵。每件事件都回答同样的核心问题，避免只放大第一件回忆。</p></div><div class="detail-list">${state.events.map((e, i) => detailCard(e, i)).join("")}</div>`;
  stage.querySelectorAll("[data-chip]").forEach((btn) => btn.addEventListener("click", () => { const [id, field, value] = btn.dataset.chip.split("|"); const d = detailsFor(id); if (field === "who") { d.who = d.who.includes(value) ? d.who.filter((x) => x !== value) : [...d.who, value]; } else d[field] = value; renderDetails(); saveState(); }));
  stage.querySelectorAll("[data-scale]").forEach((input) => input.addEventListener("input", () => { const [id, field] = input.dataset.scale.split("|"); detailsFor(id)[field] = Number(input.value); updateFader(input, id, field, Number(input.value)); saveState(); }));
  stage.querySelectorAll("[data-event-rating]").forEach((input) => input.addEventListener("input", () => {
    const [id, field] = input.dataset.eventRating.split("|");
    eventById(id)[field] = Number(input.value) / 10;
    updateFader(input, id, field, Number(input.value));
    saveState();
  }));
}

function detailCard(e, index) {
  const d = detailsFor(e.id);
  const chips = (field, list, multiple = false) => list.map((x) => `<button class="chip ${(multiple ? d[field].includes(x) : d[field] === x) ? "is-selected" : ""}" aria-pressed="${multiple ? d[field].includes(x) : d[field] === x}" data-chip="${e.id}|${field}|${x}" type="button">${x}</button>`).join("");
  return `<article class="detail-card detail-card--${e.valence > 0 ? "pos" : "neg"}">
    <h3><span class="${e.valence > 0 ? "tag-pos" : "tag-neg"}">${String(index + 1).padStart(2, "0")}</span> ${esc(e.label)}</h3>
    <div class="field"><label>主要发生在哪里？</label><div class="chip-grid">${chips("where", options.where)}</div></div>
    <div class="field"><label>主要和谁有关？可多选</label><div class="chip-grid">${chips("who", options.who, true)}</div></div>
    <div class="field"><label>主要因为什么？</label><div class="chip-grid">${chips("why", options.why)}</div></div>
    <div class="field"><label>后来怎么样了？</label><div class="chip-grid">${chips("how", options.how)}</div></div>
    <div class="context-faders">${[["closeness", "关系亲近/信任"], ["autonomy", "训练自主权"], ["fairness", "资源公平充足"]].map(([field, label]) => fader(e.id, field, label, d[field], 1, "data-scale")).join("")}</div>
    ${eventRatings(e)}
  </article>`;
}

function fader(id, field, label, value, max, attribute) {
  const inputId = `rating-${id}-${field}`;
  const current = value == null ? max / 2 : value;
  return `<div class="field fader-field ${value == null ? "is-unanswered" : ""}">
    <div class="fader-heading"><label for="${inputId}">${esc(label)}</label><output class="fader-value" id="${id}-${field}" for="${inputId}">${value == null ? "未作答" : Number(value).toFixed(max === 1 ? 2 : 1)}</output></div>
    <div class="fader-control"><input class="mixing-fader" id="${inputId}" ${attribute}="${id}|${field}" type="range" min="0" max="${max}" step="${max === 1 ? .01 : .1}" value="${current}" style="--range-fill:${current / max * 100}%" /><div class="fader-ticks" aria-hidden="true"></div></div>
    <div class="fader-ends" aria-hidden="true"><span>低 · 0</span><span>高 · ${max}</span></div>
  </div>`;
}

function updateFader(input, id, field, value) {
  document.getElementById(`${id}-${field}`).textContent = value.toFixed(Number(input.max) === 1 ? 2 : 1);
  input.style.setProperty("--range-fill", `${value / Number(input.max) * 100}%`);
  input.closest(".fader-field").classList.remove("is-unanswered");
}

function eventRatings(event) {
  return `<div class="event-ratings context-faders">${[["centrality", "在人生故事中有多重要？"], ["now_salience", "现在还影响你多少？"]].map(([field, label]) => fader(event.id, field, label, event[field] == null ? null : event[field] * 10, 10, "data-event-rating")).join("")}<p class="hint">这两项为 0 至 10 分。滑块初始位置只供操作，调整后才记录答案。</p></div>`;
}

function buildPayload() {
  const first = state.recall_log.slice().sort((a,b)=>a.recall_order-b.recall_order)[0];
  return { version: "sports-life-tree-prototype-v0.6", drawing_reference: "life-timeline-hosted-v3.6.3", created_at: new Date().toISOString(),
    profile: state.profile, exposure: StudyModel.exposure(state.profile),
    events: state.events.map((e) => ({ ...e, details: state.details[e.id] || null })), scales: state.scale,
    process: { n_events: state.events.length,
      event_response: state.events.length ? "events_selected" : StudyModel.participationGroup(state.profile) === "neither" ? "not_applicable_no_exposure" : state.event_response,
      first_recall_event: first?.id || null, first_recall_source: first?.source || null,
      recall_log: state.recall_log, order_history: state.order_history,
      final_event_order: state.events.map(e=>e.id), skipped_event_pages: !state.events.length,
      outcome_scales_status: "not_integrated" } };
}
function renderReview() {
  const payload = buildPayload();
  const positives = state.events.filter(e => e.valence > 0).length;
  const negatives = state.events.filter(e => e.valence < 0).length;
  const show3D = StudyModel.canDraw(state.profile, state.events) && state.events.some(e => LifeTree.isComplete(e, currentAge()));
  stage.innerHTML = `
    <div class="stage-head"><div class="stage-kicker">第五步 · 检查</div><h2>这是一份可导出的本地原型记录。</h2><p class="stage-lead">当前版本只验证交互流程和数据结构，不替代正式量表，也不向任何服务器发送数据。</p></div>
    <div class="review-grid"><div class="review-stat"><strong>${state.events.length}</strong><span>已记录事件</span></div><div class="review-stat"><strong>${positives} / ${negatives}</strong><span>正向 / 负向</span></div><div class="review-stat"><strong>${state.events[0] ? "已记录" : "无事件"}</strong><span>首个回忆顺序</span></div></div>
    <div class="notice">正式版本接入 CD-RISC-10、PHQ-9/GAD-7 或 PHQ-4 时，应使用已授权题目和正式计分。本原型只保留量表接口。</div>
    ${show3D ? '<section class="three-d-card" aria-labelledby="threeDHeading"><h3 id="threeDHeading">你的 3D 生命树</h3><p>拖动旋转视角，可切换地面 2D 与立体视图。点击轨迹查看对应经历。</p><div id="threeDTree" class="three-d-host"></div></section>' : ''}
    <p class="hint" style="margin-top:20px">你可以点击右下角下载 JSON，把事件级记录交给后续分析脚本。</p><textarea class="json-box" readonly>${esc(JSON.stringify(payload, null, 2))}</textarea>`;
  if (show3D) LifeTree3D.render({ host: document.getElementById('threeDTree'), events: state.events, details: state.details, age: currentAge() });
}

function downloadJSON() { const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sports-life-tree-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href); }

function validate() {
  if (state.step === 0 && (!Number.isFinite(Number(state.profile.age)) || Number(state.profile.age) < 16 || Number(state.profile.age) > 35)) {
    alert("请填写 16 至 35 岁之间的有效年龄。"); return false;
  }
  if (state.step === 0) {
    if (StudyModel.participationGroup(state.profile) === "unknown") { alert("请分别选择是否有比赛经历、是否有专项训练经历。"); return false; }
    if (state.profile.competition_history === true && typeof state.profile.award_history !== "boolean") { alert("请补充是否曾在体育比赛中获奖。"); return false; }
    for (const [key,max] of [["activity_days",7],["activity_minutes",1440]]) {
      const value = state.profile[key];
      if (value !== "" && (!Number.isInteger(Number(value)) || Number(value)<0 || Number(value)>max)) { alert(key === "activity_days" ? "活动天数请填写 0 至 7 的整数，或留空。" : "平均分钟数请填写 0 至 1440 的整数，或留空。"); return false; }
    }
  }
  if (state.step === 1) {
    let message = "";
    if (StudyModel.participationGroup(state.profile) === "neither" && state.events.length) message = "请核对背景与已选事件：没有比赛和专项训练经历时，不应保留相应事件。";
    else if (eventById("award") && (state.profile.competition_history !== true || state.profile.award_history !== true)) message = "已选获奖事件，请返回背景核对比赛和获奖经历。";
    else if (!state.events.length && StudyModel.participationGroup(state.profile) !== "neither" && !["none_recalled","prefer_not_to_answer"].includes(state.event_response)) message = "请选择没有符合条目的经历，或暂不愿回忆或回答。";
    if (message) { document.getElementById("eventMessage").textContent = message; return false; }
  }
  if (state.step === 2) {
    const index = state.events.findIndex((event) => !LifeTree.isComplete(event, currentAge()));
    if (index >= 0) {
      state.trajectoryIndex = index; renderTrajectories();
      document.getElementById("drawStatus").textContent = "还有经历未画，请按顺序画完，或返回修改勾选。";
      return false;
    }
  }
  return true;
}
nextBtn.addEventListener("click", () => { if (!validate()) return; if (state.step === 4) { downloadJSON(); return; } state.step = state.step === 1 && !state.events.length ? 4 : state.step + 1; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
backBtn.addEventListener("click", () => { if (state.step > 0) { state.step = state.step === 4 && !state.events.length ? 1 : state.step - 1; render(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
document.getElementById("resetBtn").addEventListener("click", () => { if (!window.confirm("清空本地草稿并重新开始？")) return; localStorage.removeItem(STORAGE_KEY); state = defaultState(); render(); });
document.querySelectorAll(".step-dot").forEach((btn) => btn.addEventListener("click", () => { const n = Number(btn.dataset.step); if (n <= state.step) { state.step = n; render(); } }));

render();
