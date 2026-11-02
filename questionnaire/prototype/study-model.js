(function(root) {
  function participationGroup(profile) {
    const training = profile.training_history, competition = profile.competition_history;
    if (typeof training !== 'boolean' || typeof competition !== 'boolean') return 'unknown';
    return training ? (competition ? 'training_and_competition' : 'training_only')
      : (competition ? 'competition_only' : 'neither');
  }
  function exposure(profile) {
    return { group: participationGroup(profile),
      training_history: profile.training_history ?? null,
      competition_history: profile.competition_history ?? null,
      award_history: profile.competition_history === false ? false : profile.competition_history === true ? profile.award_history ?? null : null,
      award_source: profile.competition_history === false ? 'structural_zero_no_competition'
        : profile.competition_history === true && typeof profile.award_history === 'boolean' ? 'self_report' : 'unanswered' };
  }
  function canDraw(profile, events) { return participationGroup(profile) !== 'neither' && events.length > 0; }
  const api = { participationGroup, exposure, canDraw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudyModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
