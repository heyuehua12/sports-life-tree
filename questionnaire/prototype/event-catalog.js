(function (root) {
  // Candidate items for the prototype, not a validated event scale.
  const items = [
    { id: 'award', label: '拿到想要的名次、奖项或荣誉', domain: '比赛与成就', theme: '比赛、选拔与机会', valence: 1, hint: '包括个人奖和团队奖' },
    { id: 'selection', label: '通过一次重要选拔或进入更高水平队伍', domain: '比赛与成就', theme: '比赛、选拔与机会', valence: 1, hint: '可记录校队、院队、俱乐部或更高层级' },
    { id: 'resource_opportunity', label: '获得重要的训练资源、参赛机会或资助', domain: '环境与资源', theme: '比赛、选拔与机会', valence: 1, hint: '例如获得场地、器材、经费或参加活动的机会' },
    { id: 'training_start', label: '开始一段对自己有意义的专项训练', domain: '训练与成长', theme: '训练、身体与学业', valence: 1, hint: '不要求参加比赛或获得奖项' },
    { id: 'breakthrough', label: '训练中完成一次重要突破', domain: '训练与成长', theme: '训练、身体与学业', valence: 1, hint: '技术、成绩或完成一项训练目标均可' },
    { id: 'recovery_return', label: '伤病康复后，恢复了想参加的训练或比赛', domain: '身体与恢复', theme: '训练、身体与学业', valence: 1, hint: '可以记录恢复参与或逐步回到原有水平' },
    { id: 'physical_progress', label: '训练使体能或身体状态出现重要改善', domain: '身体与恢复', theme: '训练、身体与学业', valence: 1, hint: '例如力量、耐力或身体功能出现让你记住的变化' },
    { id: 'study_balance', label: '顺利解决一次学业与训练或比赛的冲突', domain: '学业与体育', theme: '训练、身体与学业', valence: 1, hint: '例如获得安排上的支持，兼顾课程、考试与训练' },
    { id: 'training_choice', label: '获得自主选择训练项目或安排的机会', domain: '参与与自主', theme: '训练、身体与学业', valence: 1, hint: '例如能参与决定项目、训练计划或参与方式' },
    { id: 'support', label: '在训练或比赛中得到关键帮助', domain: '支持与关系', theme: '关系、支持与归属', valence: 1, hint: '来自教练、队友、家人、同学或学校' },
    { id: 'team_belonging', label: '被队伍接纳或形成重要团队关系', domain: '支持与关系', theme: '关系、支持与归属', valence: 1, hint: '也可以是重新融入队伍或建立合作关系' },
    { id: 'recognition', label: '自己的努力或进步得到重要肯定', domain: '支持与关系', theme: '关系、支持与归属', valence: 1, hint: '例如获得教练、队友或家人的认可，不要求正式获奖' },
    { id: 'failed_selection', label: '选拔落选或重要比赛失利', domain: '困难与中断', theme: '比赛、选拔与机会', valence: -1, hint: '可以记录符合实际的经历，不要求是影响最大的一件' },
    { id: 'resource_gap', label: '器材、场地、经费或机会不足', domain: '环境与资源', theme: '比赛、选拔与机会', valence: -1, hint: '包括因此无法训练、参赛或继续参与' },
    { id: 'unfair_treatment', label: '选拔、参赛机会或判罚让自己感到不公平', domain: '规则与公平', theme: '比赛、选拔与机会', valence: -1, hint: '按当时的实际经历和感受选择' },
    { id: 'injury', label: '伤病影响训练或比赛', domain: '困难与中断', theme: '训练、身体与学业', valence: -1, hint: '包括恢复期、反复伤病或被迫减少参与' },
    { id: 'training_pause', label: '因学业、家庭或其他原因中断训练', domain: '困难与中断', theme: '训练、身体与学业', valence: -1, hint: '可以是主动或被动中断，只选当时感到负面的经历' },
    { id: 'training_overload', label: '训练负荷过重或休息不足，打乱原有生活', domain: '训练负荷', theme: '训练、身体与学业', valence: -1, hint: '例如训练安排挤占恢复、课程或日常生活时间' },
    { id: 'study_conflict', label: '训练或比赛与重要课程、考试发生冲突', domain: '学业与体育', theme: '训练、身体与学业', valence: -1, hint: '例如错过课程、考试安排困难或学业受到影响' },
    { id: 'exit_transition', label: '退出队伍、转队或更换教练带来困难', domain: '转变与退出', theme: '训练、身体与学业', valence: -1, hint: '可以记录过渡、重新适应或失去参与机会的经历' },
    { id: 'coach_conflict', label: '与教练或队友发生重要冲突', domain: '困难与关系', theme: '关系、支持与归属', valence: -1, hint: '只记录你愿意回忆的内容' },
    { id: 'exclusion', label: '在体育活动中被排斥、贬低或区别对待', domain: '困难与关系', theme: '关系、支持与归属', valence: -1, hint: '例如被孤立、嘲讽或因身份、能力受到不友善对待' },
    { id: 'external_pressure', label: '被要求参加自己不愿参加的训练或比赛', domain: '参与与自主', theme: '关系、支持与归属', valence: -1, hint: '例如难以拒绝来自教练、队伍或家人的安排' },
    { id: 'body_pressure', label: '因运动中的体重、体型或外貌要求受到施压', domain: '身体与关系', theme: '关系、支持与归属', valence: -1, hint: '只记录愿意分享的经历，无需描述具体身体信息' },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = items;
  else root.SportsEventCatalog = items;
})(typeof window !== 'undefined' ? window : globalThis);
