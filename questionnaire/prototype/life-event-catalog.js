(function (root) {
  // Adapted candidate prompts, not the complete ASLEC/CTQ or a validated scale.
  const rows = [
    ['family_understanding','与家人的关系或相互理解有了重要改善','家庭与生活',1,['家庭','人际']],
    ['family_support','在困难时得到家人的重要支持','家庭与生活',1,['家庭','人际']],
    ['family_conflict','家庭内部的重要矛盾让自己感到困难','家庭与生活',-1,['家庭','人际']],
    ['financial_hardship','家庭经济困难影响了自己的生活或学习','家庭与生活',-1,['家庭','学业']],
    ['friendship','交到重要的朋友或被一个群体接纳','人际与亲密关系',1,['人际']],
    ['relationship_start','建立了一段对自己重要的亲密关系','人际与亲密关系',1,['人际']],
    ['friend_conflict','与重要的朋友或同学发生冲突、疏远','人际与亲密关系',-1,['人际']],
    ['relationship_loss','重要的亲密关系结束或遇到困难','人际与亲密关系',-1,['人际']],
    ['academic_success','通过重要考试、升学或学业选拔','学业与发展',1,['学业','生活转变']],
    ['academic_progress','学习或研究中完成了一次重要突破','学业与发展',1,['学业','个人成长']],
    ['academic_setback','重要考试、升学或学业选拔未达预期','学业与发展',-1,['学业']],
    ['academic_pressure','一段学业压力或负担明显加重的经历','学业与发展',-1,['学业']],
    ['health_recovery','疾病或受伤后，身体或生活逐步恢复','健康与丧失',1,['健康']],
    ['help_received','在重要困难中得到他人的帮助或支持','健康与丧失',1,['人际','个人成长']],
    ['illness_accident','自己经历了重要疾病、受伤或意外','健康与丧失',-1,['健康']],
    ['bereavement','亲友离世或经历重要的丧失','健康与丧失',-1,['家庭','人际']],
    ['new_environment','进入大学或新环境后，逐渐适应并找到归属','环境与转变',1,['生活转变','人际']],
    ['independence','独立处理了一件对自己重要的事情','环境与转变',1,['生活转变','个人成长']],
    ['school_change','转学、休学、搬迁或环境变化带来困难','环境与转变',-1,['生活转变','学业']],
    ['discrimination','在生活或学习中被排斥、贬低或区别对待','环境与转变',-1,['人际']],
    ['new_skill','掌握一项对自己有意义的技能或爱好','成长与机会',1,['个人成长']],
    ['recognition','自己的作品、付出或进步得到重要认可','成长与机会',1,['个人成长','人际']],
    ['opportunity_lost','错过或失去一次对自己重要的机会','成长与机会',-1,['个人成长','生活转变']],
    ['separation','长期远离家人或重要他人，感到难以适应','成长与机会',-1,['家庭','人际','生活转变']],
  ];
  const items = rows.map(([key,label,theme,valence,domains]) => ({
    id: 'life_' + key, label, theme, domain: theme, valence, domains, source_scope: 'general',
    hint: '按当时的感受选择；与体育有关的同一件事也只记一次',
  }));
  if (typeof module !== 'undefined' && module.exports) module.exports = items;
  else root.LifeEventCatalog = items;
})(typeof window !== 'undefined' ? window : globalThis);
