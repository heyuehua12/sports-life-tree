(function (root) {
  'use strict';
  // Same geometry and impact scale as the mentor's drawing core.
  const BOX = { width: 360, height: 540, center: 204, top: 64, bottom: 500, radius: 30 };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const round = (n, digits = 3) => Number(n.toFixed(digits));
  const pixFromR = (r) => 30 * 2 ** (2 * clamp(r, 0, 1));
  function rFromX(x) {
    const pix = Math.abs(x - BOX.center);
    return pix < 27 ? Math.max(.02, pix / 30 * .12)
      : Math.max(.05, clamp(Math.log2(Math.max(25.5, pix) / 30) / 2, 0, 1));
  }
  function pointToAR(p, age) {
    return [round(clamp((BOX.bottom - p.y) / (BOX.bottom - BOX.top), 0, 1) * age, 1),
      round((p.x < BOX.center ? -1 : 1) * rFromX(p.x))];
  }
  function arToPoint(pair, age) {
    return { x: BOX.center + (Math.sign(pair[1]) || 1) * pixFromR(Math.abs(pair[1])),
      y: BOX.bottom - pair[0] / age * (BOX.bottom - BOX.top) };
  }
  function isComplete(event, age) {
    const path = event.path_ar;
    return event.trajectory_version === 3 && event.trajectory_age_now === age &&
      Array.isArray(path) && path.length >= 2 && path.length <= 32 &&
      path.every((p, i) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
        p[0] >= 0 && p[0] <= age && Math.abs(p[1]) <= 1 && (!i || p[0] >= path[i - 1][0])) &&
      (event.valence > 0 ? path[0][1] > 0 : path[0][1] < 0);
  }
  const api = { BOX, clamp, round, pixFromR, rFromX, pointToAR, arToPoint, isComplete };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LifeTree = api;
})(typeof window !== 'undefined' ? window : globalThis);
