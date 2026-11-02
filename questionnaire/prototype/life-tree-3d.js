(function (root) {
  'use strict';
  // Transport-only adapter. Scientific fields stay in the questionnaire.
  function payloadFor(events, details, age) {
    return {
      age_now: age, tool_version: 'sports-life-tree-prototype-v0.7',
      events: events.filter(e => root.LifeTree.isComplete(e, age)).map(e => {
        const d = details[e.id] || {};
        return { ...e, event_id: e.id, item_key: e.label,
          where: d.where ?? null, who: Array.isArray(d.who) ? d.who.join('、') || null : d.who ?? null,
          why: d.why ?? null, how: d.how ?? null, closeness: d.closeness ?? null,
          // The old drawing core supplies defaults without sports norms.
          // Do not display them as established severity measurements.
          obj_raw: null, obj_w: null, theta: null,
        };
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
    note.textContent = '角度按“在人生故事中有多重要”评分展开；' + (missing ? `${missing} 件未评分的经历暂用各自半区中线展示。` : '正向在右半区，负向在左半区。') + '黄色合成箭杆及 +1 年外推沿用原版，仅作几何示意。原版 3D 用影响绝对值显示，跨轴方向仍保留在二维轨迹和导出记录中。';
    const receive = event => {
      if (event.origin !== location.origin || event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'sports-life-tree-ready') iframe.contentWindow.postMessage({ type: 'sports-life-tree-data', payload }, location.origin);
      if (event.data?.type === 'sports-life-tree-rendered') status.textContent = `已显示 ${event.data.count} 条作答轨迹 · 点击轨迹按钮查看情境与评分`;
      if (event.data?.type === 'sports-life-tree-error') status.textContent = '三维显示失败：' + event.data.message;
    };
    window.addEventListener('message', receive);
    stopPrevious = () => window.removeEventListener('message', receive);
    host.append(iframe, status, note);
  }
  root.LifeTree3D = { render, dispose, payloadFor };
})(typeof window !== 'undefined' ? window : globalThis);
