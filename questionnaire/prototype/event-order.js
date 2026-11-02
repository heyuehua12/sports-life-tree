(function (root) {
  function normalize(state) {
    state.recall_log ||= [];
    state.order_history ||= [];
    let counter = Math.max(0, ...state.recall_log.map(x => x.recall_order || 0), ...state.events.map(x => x.recall_order || 0));
    state.events.forEach(event => {
      if (!event.recall_order) {
        event.recall_order = ++counter;
        event.recall_order_source = 'legacy_snapshot';
        state.recall_log.push({ id: event.id, label: event.label, recall_order: counter, source: 'legacy_snapshot' });
      }
    });
    renumber(state);
  }
  function renumber(state) { state.events.forEach((e, i) => { e.select_order = i + 1; }); }
  function add(state, event) {
    const previous = state.recall_log.find(x => x.id === event.id);
    const order = previous?.recall_order || Math.max(0, ...state.recall_log.map(x => x.recall_order || 0)) + 1;
    if (!previous) state.recall_log.push({ id: event.id, label: event.label, recall_order: order, source: 'observed', at: new Date().toISOString() });
    state.events.push({ ...event, recall_order: order, recall_order_source: previous?.source || 'observed' });
    renumber(state);
  }
  function reorder(state, ids) {
    const before = state.events.map(e => e.id);
    if (ids.length !== before.length || new Set(ids).size !== ids.length || ids.some(id => !before.includes(id))) return false;
    if (ids.every((id, i) => id === before[i])) return false;
    const byId = new Map(state.events.map(e => [e.id, e]));
    state.events = ids.map(id => byId.get(id));
    renumber(state);
    state.order_history.push({ before, after: ids.slice(), at: new Date().toISOString() });
    return true;
  }
  function bind(list, state, onChange) {
    const move = (id, direction) => {
      const ids = state.events.map(e => e.id), i = ids.indexOf(id), next = i + direction;
      if (next < 0 || next >= ids.length) return;
      [ids[i], ids[next]] = [ids[next], ids[i]];
      if (reorder(state, ids)) onChange(id);
    };
    list.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.id, Number(button.dataset.move))));
    list.querySelectorAll('.order-handle').forEach(handle => {
      handle.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); move(handle.dataset.id, event.key === 'ArrowUp' ? -1 : 1);
      });
      let drag = null;
      handle.addEventListener('pointerdown', event => {
        if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        drag = { pointerId: event.pointerId, row: handle.closest('.selected-row') };
        handle.setPointerCapture(event.pointerId);
        drag.row.classList.add('is-dragging');
        handle.setAttribute('aria-pressed', 'true');
      });
      handle.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const siblings = [...list.children].filter(row => row !== drag.row);
        const target = siblings.find(row => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
        list.insertBefore(drag.row, target || null);
        handle.setPointerCapture(event.pointerId);
        if (event.clientY < 75) window.scrollBy(0, -14);
        if (event.clientY > window.innerHeight - 75) window.scrollBy(0, 14);
      });
      const finish = event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.row.classList.remove('is-dragging'); drag = null;
        handle.setAttribute('aria-pressed', 'false');
        const changed = event.type === 'pointerup' && reorder(state, [...list.children].map(row => row.dataset.id));
        if (changed) onChange(handle.dataset.id);
        else state.events.forEach(e => list.appendChild([...list.children].find(row => row.dataset.id === e.id)));
      };
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
      handle.addEventListener('lostpointercapture', finish);
    });
  }
  const api = { normalize, renumber, add, reorder, bind };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EventOrder = api;
})(typeof window !== 'undefined' ? window : globalThis);
