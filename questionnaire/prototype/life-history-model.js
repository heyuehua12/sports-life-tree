(function (root) {
  'use strict';
  const VERSION = 'sports-life-tree-prototype-v0.9.1';
  const DOMAINS = ['家庭','学业','人际','健康','生活转变','个人成长'];
  const RELATIONS = { none:'与体育无关', training:'专项训练', competition:'体育比赛', training_and_competition:'训练与比赛都有', everyday_activity:'体育课或日常运动', sports_unspecified:'与体育有关，具体场景说不清', uncertain:'是否与体育有关说不清' };
  const sportsRelations = ['training','competition','training_and_competition','everyday_activity'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const sportsDomains = item => /伤病|身体|康复|体能/.test(item.label) ? ['体育','健康']
    : /学业|课程|考试/.test(item.label) ? ['体育','学业']
    : /关系|帮助|队友|教练|接纳|认可|排斥|施压/.test(item.label) ? ['体育','人际'] : ['体育','个人成长'];
  function normalizeEvent(event) {
    event.source_scope ||= 'sports'; // All pre-v0.7 records were sports prompts.
    event.source_scopes ||= [event.source_scope];
    event.source_catalog_ids ||= event.custom ? [] : [event.id];
    event.domains = [...new Set(event.domains || (event.source_scope === 'sports' ? sportsDomains(event) : []))];
    if (event.sports_relation === undefined) event.sports_relation = event.source_scope === 'sports' ? 'sports_unspecified' : null;
    event.relation_confirmed ??= false;
    return event;
  }
  function normalize(state) {
    const migrated = state.schema_version !== VERSION;
    const fromVersion = state.schema_version;
    // v0.7–v0.9 already contain shared-life-history answers. The v0.9.1
    // release only tightens presentation and mapping; it must not turn a
    // previously confirmed rating into `legacy_unverified`.
    const preSharedHistory = !['sports-life-tree-prototype-v0.7','sports-life-tree-prototype-v0.8','sports-life-tree-prototype-v0.9',VERSION].includes(fromVersion);
    state.events.forEach(normalizeEvent);
    state.merge_history ||= [];
    if (migrated) {
      if (preSharedHistory) Object.values(state.details || {}).forEach(raw => {
        if (!raw) return;
        raw.rating_provenance ||= {};
        for (const field of ['closeness','autonomy','fairness']) if (raw[field] != null && !raw.rating_provenance[field]) raw.rating_provenance[field] = 'legacy_unverified';
      });
      state.migrations ||= [];
      state.events.forEach(event=>{
        if(event.source_catalog_ids.some(id=>id.startsWith('life_'))){event.legacy_catalog=true;event.source_catalog||='general-candidate-v0.7';}
      });
      state.migrations.push({ from:fromVersion||'unversioned',to: VERSION, at: new Date().toISOString(), note: '原有事件、轨迹和原答保留；事件清单全部展开，接通原版 F0–F20 映射，新增类别由本人补选对应关系。' });
      if (preSharedHistory && !state.events.length) state.event_response = null;
    }
    state.sports_event_response ??= null;
    state.tutor ??= null;
    state.tutor_sessions ||= [];
    state.schema_version = VERSION;
    return state;
  }
  function makeEvent(item) { return normalizeEvent({ ...clone(item), source_scope: item.source_scope || 'sports' }); }
  const isSports = event => sportsRelations.includes(event.sports_relation) || event.sports_relation === 'sports_unspecified';
  const isTraining = event => ['training','training_and_competition'].includes(event.sports_relation);
  const isCompetition = event => ['competition','training_and_competition'].includes(event.sports_relation);
  const isSpecialistEvent = event => isTraining(event) || isCompetition(event) || event.sports_relation === 'sports_unspecified';
  const hasSpecialistExposure = p => p.training_history === true || p.competition_history === true;
  function matchesFilter(event, filter) {
    if (filter === 'all') return true;
    if (filter === 'sports') return isSports(event);
    if (filter === 'general') return event.sports_relation === 'none';
    return false;
  }
  function setRelation(event, relation) {
    if (!(relation in RELATIONS)) return false;
    event.sports_relation = relation;
    event.relation_confirmed = true;
    delete event.merge_relation_needs_confirmation;
    event.domains = event.domains.filter(d => d !== '体育');
    if (isSports(event)) event.domains.push('体育');
    return true;
  }
  function validationErrors(profile, events, responses = {}) {
    const errors = [];
    if (!events.length && !['none_recalled','prefer_not_to_answer'].includes(responses.event_response)) errors.push('请选择没有回忆起符合条目的经历，或暂不愿回忆或回答。');
    events.forEach(e => {
      if (!e.relation_confirmed || !(e.sports_relation in RELATIONS)) errors.push(`请确认“${e.label}”与体育的关系。`);
      if (!e.domains.length) errors.push(`请为“${e.label}”选择至少一个领域。`);
      if (isTraining(e) && profile.training_history !== true) errors.push(`“${e.label}”涉及专项训练，请核对背景或体育关系。`);
      if (isCompetition(e) && profile.competition_history !== true) errors.push(`“${e.label}”涉及比赛，请核对背景或体育关系。`);
      if (e.source_scopes.includes('sports') && (!isSports(e) || !hasSpecialistExposure(profile))) errors.push(`“${e.label}”包含体育专项条目，请核对背景或移除不适用条目。`);
      if (e.source_catalog_ids.includes('award') && (profile.competition_history !== true || profile.award_history !== true)) errors.push('已选体育获奖事件，请返回背景核对比赛和获奖经历。');
    });
    const specialistEvents = events.some(isSpecialistEvent);
    if (hasSpecialistExposure(profile) && !specialistEvents && !['none_recalled','prefer_not_to_answer'].includes(responses.sports_event_response)) errors.push('请说明体育专项事件部分是没有回忆起符合条目的经历，还是暂不愿回答。');
    return [...new Set(errors)];
  }
  function merge(state, fromId, intoId, { acceptValence = false } = {}) {
    if (fromId === intoId) return false;
    const from = state.events.find(e => e.id === fromId), into = state.events.find(e => e.id === intoId);
    if (!from || !into || (from.valence !== into.valence && !acceptValence)) return false;
    const entry = { at: new Date().toISOString(), from_id: fromId, into_id: intoId,
      originals: [{ event: clone(into), details: clone(state.details[intoId] || null) }, { event: clone(from), details: clone(state.details[fromId] || null) }],
      policy: '保留目标事件的轨迹和原答；双方原始记录完整归档，不自动推断正负或体育关系。' };
    state.merge_history.push(entry);
    into.domains = [...new Set([...into.domains,...from.domains])];
    into.source_scopes = [...new Set([...into.source_scopes,...from.source_scopes])];
    into.source_catalog_ids = [...new Set([...into.source_catalog_ids,...from.source_catalog_ids])];
    into.merged_recall_orders = [...new Set([into.recall_order,from.recall_order,...(into.merged_recall_orders||[]),...(from.merged_recall_orders||[])].filter(Number.isFinite))].sort((a,b)=>a-b);
    if (into.sports_relation !== from.sports_relation) {
      into.sports_relation = into.source_scopes.includes('sports') ? 'sports_unspecified' : null;
      into.relation_confirmed = false;
      into.merge_relation_needs_confirmation = true;
    }
    state.events = state.events.filter(e => e.id !== fromId);
    state.events.forEach((e,i) => { e.select_order = i + 1; });
    return true;
  }
  const ratingValue = (raw, field) => raw.rating_provenance?.[field] === 'legacy_unverified' ? null : raw[field] ?? null;
  function detailsForExport(event, raw = {}) {
    const people=Array.isArray(raw.who)?raw.who:[];
    const primary=people.length===1?people[0]:people.includes(raw.who_primary)?raw.who_primary:null;
    const interpersonal=primary&&!['自己','说不清'].includes(primary);
    const d = { where: raw.where ?? null, who: raw.who || [], why: raw.why ?? null, how: raw.how ?? null,
      where_basis: raw.where_basis ?? null, who_primary: raw.who_primary ?? null, who_tie_basis: raw.who_tie_basis ?? null, why_basis: raw.why_basis ?? null,
      age_mid: raw.age_mid ?? null, r_mid: ratingValue(raw,'r_mid'),
      closeness: interpersonal ? ratingValue(raw,'closeness') : null,
      sports_module_status: isTraining(event) || isCompetition(event) ? 'applicable' : 'not_applicable',
      autonomy: isTraining(event) ? ratingValue(raw,'autonomy') : null,
      fairness: isTraining(event) || isCompetition(event) ? ratingValue(raw,'fairness') : null,
      training_phase: isTraining(event) ? raw.training_phase ?? null : null,
      competition_level: isCompetition(event) ? raw.competition_level ?? null : null,
      competition_outcome: isCompetition(event) ? raw.competition_outcome ?? null : null,
      award_level: isCompetition(event) && (event.source_catalog_ids.includes('award') || raw.competition_outcome === 'awarded') ? raw.award_level ?? null : null,
      injury_related: isTraining(event) || isCompetition(event) ? raw.injury_related ?? null : null,
      injury_stop_days: (isTraining(event) || isCompetition(event)) && raw.injury_related === true ? raw.injury_stop_days ?? null : null,
      unconfirmed_legacy_ratings: Object.entries(raw.rating_provenance||{}).filter(([,v])=>v==='legacy_unverified').map(([key])=>key) };
    return d;
  }
  function timing(event, profile) {
    if (profile.training_history !== true) return 'not_applicable_no_training';
    const start = profile.training_start_age;
    const points = event.path_ar;
    if (start === '' || start == null || !Number.isFinite(Number(start)) || !points?.length) return 'unknown';
    if (points.at(-1)[0] < Number(start)) return 'before_training';
    if (points[0][0] >= Number(start)) return 'after_training_started';
    return 'spans_training_start';
  }
  const api = { VERSION, DOMAINS, RELATIONS, normalize, normalizeEvent, makeEvent, isSports, isTraining, isCompetition, isSpecialistEvent, hasSpecialistExposure, matchesFilter, setRelation, validationErrors, merge, detailsForExport, ratingValue, timing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LifeHistory = api;
})(typeof window !== 'undefined' ? window : globalThis);
