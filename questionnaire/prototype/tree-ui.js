window.LifeTreeUI = (() => {
  const geometryKeys = ['trajectory_version', 'path_ar', 'path_ar_n', 'path_n', 'age_start', 'age_end',
    'r_then', 'r_now', 'side_then', 'side_now', 'cross_axis', 'age_cross', 'r_cross',
    'impact_delta', 'trajectory_age_now', 'draw_ms', 'press_ms', 'path_len', 'mark_order', 'rank_now', 'item_key'];

  function render({ stage, state, age, esc, save, onBack, onDone }) {
    if (!state.events.length) {
      stage.innerHTML = '<div class="stage-head"><div class="stage-kicker">第三步 · 生命树</div><h2>没有相关事件，也是一种真实记录。</h2><p class="stage-lead">没有选择体育事件，可以直接继续。</p></div>';
      return;
    }
    const legacy = state.events.filter((e) => e.path_ar?.length && !LifeTree.isComplete(e, age)).length;
    stage.innerHTML = `<div class="mentor-intro"><h2>画出经历留下的影响。</h2><p>在事情发生的年龄落笔，按住向上画到现在。离树干越远，影响越大；途中可以跨过树干。</p>${legacy ? '<p class="mentor-migration">已有轨迹使用旧画法或旧年龄，请按原版画法重新绘制。原记录会保留备份。</p>' : ''}</div><div id="mentorTree" class="mentor-tree-host"></div>`;
    const host = document.getElementById('mentorTree');
    const pool = state.events.map((e, i) => ({ ...e, item_key: e.id, display_label: e.label,
      select_order: e.select_order || i + 1, is_custom: !!e.custom }));
    // IDs are stable even when two user-written labels are identical.
    const prior = state.events.filter((e) => LifeTree.isComplete(e, age)).map((e) => ({ ...e, item_key: e.id })).sort((a,b)=>(a.mark_order||0)-(b.mark_order||0));
    const sync = (drawn) => {
      const byKey = new Map(drawn.map((e) => [e.item_key, e]));
      state.events.forEach((event) => {
        const geometry = byKey.get(event.id);
        if (!geometry) {
          if (LifeTree.isComplete(event, age)) geometryKeys.forEach((key) => delete event[key]);
          return;
        }
        if (event.path_ar?.length && !LifeTree.isComplete(event, age)) {
          event.previous_trajectories ||= [];
          event.previous_trajectories.push(Object.fromEntries(geometryKeys.filter((key) => key in event).map((key) => [key, event[key]])));
        }
        geometryKeys.forEach((key) => { if (key in geometry) event[key] = geometry[key]; });
        event.trajectory_version = 3;
        event.trajectory_age_now = age;
        event.impact_delta = LifeTree.round(event.r_now - event.r_then);
      });
      save();
    };
    const plugin = new MentorLifeTree({ finishTrial(data) {
      if (data.go_back) { onBack(); return; }
      sync(data.events);
      onDone();
    } });
    plugin._draw(host, {
      max_age: age, selected_items: pool, prior_events: prior,
      is_focal_now: true, hard_max: state.events.length,
      suggest_min: state.events.length, suggest_max: state.events.length,
      allow_skip: false, allow_stage_back: true, stage_back_to: 'checklist',
      stage_back_label: '返回修改勾选', on_change: sync,
    });
  }
  return { render };
})();
