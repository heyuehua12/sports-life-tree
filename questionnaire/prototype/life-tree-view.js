(function(root) {
  'use strict';
  // Read-only replay using the same signed coordinates as the mentor drawing core.
  function render({host,events,age,filter='all',esc}) {
    const visible=events.filter(e=>LifeTree.isComplete(e,age)&&LifeHistory.matchesFilter(e,filter));
    const {width,height,center,top,bottom}=LifeTree.BOX;
    const ages=Array.from(new Set([0,...Array.from({length:Math.floor(age/5)},(_,i)=>(i+1)*5),age]));
    host.innerHTML=`<div class="shared-tree-layout"><svg class="shared-tree-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="共同生命树：左绿负向，右紫正向，纵向为年龄。当前显示 ${visible.length} 条轨迹">
      <rect width="${center}" height="${height}" fill="#edf5ef"/><rect x="${center}" width="${width-center}" height="${height}" fill="#f6eff8"/>
      <text x="72" y="30" fill="#2D8B4A" text-anchor="middle">不好的事</text><text x="288" y="30" fill="#7B2D8B" text-anchor="middle">好事</text>
      ${ages.map(a=>{const y=bottom-a/age*(bottom-top);return `<line x1="38" x2="345" y1="${y}" y2="${y}" stroke="#d6e0d8"/><text x="12" y="${y+4}" fill="#52675e" font-size="11">${a}岁</text>`;}).join('')}
      <line x1="${center}" x2="${center}" y1="${top}" y2="${bottom}" stroke="#8b6d4a" stroke-width="9" stroke-linecap="round"/>
      ${visible.map(e=>{const points=e.path_ar.map(p=>LifeTree.arToPoint(p,age));const color=e.valence>0?'#7B2D8B':'#2D8B4A';return `<g><title>${esc(e.label)}</title><polyline points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${points[0].x}" cy="${points[0].y}" r="4" fill="${color}"/><circle cx="${points.at(-1).x}" cy="${points.at(-1).y}" r="4" fill="white" stroke="${color}" stroke-width="2"/></g>`;}).join('')}
      <text x="${center}" y="526" text-anchor="middle" fill="#63746b" font-size="11">离树干越远，影响越大</text></svg><div class="shared-tree-legend"><p>显示 ${visible.length} 条已完成轨迹</p>${visible.map(e=>`<p><span class="${e.valence>0?'tag-pos':'tag-neg'}">${e.valence>0?'●':'●'}</span> ${esc(e.label)}<small>${e.domains.map(esc).join(' · ')}</small></p>`).join('')}${!visible.length?'<p>这个范围暂时没有已完成轨迹，可切换“全部”。</p>':''}</div></div>`;
  }
  root.LifeTreeView={render};
})(typeof window!=='undefined'?window:globalThis);
